// Persona + mode selector for AI Speaking — RN parity of the web CompanionSelect.
// Three modes (Hội thoại / Gia sư Việt / Interview), grouped personas with avatars,
// per-persona accent theming, and mode-specific config (position / scenario / level).

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { MotiView } from 'moti'
import { useQuery } from '@tanstack/react-query'
import {
  MessageCircle, GraduationCap, Briefcase, Lock, Check,
  Laptop, ShoppingBag, Stethoscope, Wrench, UtensilsCrossed, Mic, Languages,
  type LucideIcon,
} from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Icon, Button } from '@/components/ui'
import { SpotlightTarget } from '@/components/guide/SpotlightTour'
import { SPOTLIGHT_TARGETS } from '@/components/guide/spotlightTours'
import {
  PERSONA_LIST,
  PERSONA_GROUPS,
  type PersonaToken,
  type PersonaGroup,
} from '@/lib/personas'
import { PersonaAvatar } from '@/components/speaking/PersonaAvatar'
import { speakingApi, type SpeakingSessionMode } from '@/lib/speakingApi'

export interface StartArgs {
  persona: PersonaToken
  sessionMode: SpeakingSessionMode
  topic: string
  cefrLevel: string
  interviewPosition?: string
  experienceLevel?: string
}

interface CompanionSelectProps {
  isPro: boolean
  starting: boolean
  onStart: (args: StartArgs) => void
  /** Preselect a mode (e.g. routed in from onboarding's INTERVIEW_FIRST). */
  initialMode?: SpeakingSessionMode
}

const MODES: { key: SpeakingSessionMode; label: string; icon: LucideIcon }[] = [
  { key: 'COMMUNICATION', label: 'Hội thoại', icon: MessageCircle },
  { key: 'INTERVIEW', label: 'Phỏng vấn', icon: Briefcase },
  { key: 'LESSON', label: 'Luyện tập', icon: GraduationCap },
]

const GROUP_ICONS: Record<PersonaGroup, LucideIcon> = {
  it: Laptop,
  verkauf: ShoppingBag,
  medizin: Stethoscope,
  maschinenbau: Wrench,
  service: UtensilsCrossed,
  medien: Mic,
  special: Languages,
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

const EXPERIENCE: { id: string; label: string }[] = [
  { id: '0-6M', label: '0-6 tháng' },
  { id: '6-12M', label: '6-12 tháng' },
  { id: '1-2Y', label: '1-2 năm' },
  { id: '3Y', label: '3 năm' },
  { id: '5Y', label: '5+ năm' },
]

export function CompanionSelect({ isPro, starting, onStart, initialMode }: CompanionSelectProps) {
  const theme = useTheme()
  const [mode, setMode] = useState<SpeakingSessionMode>(initialMode ?? 'COMMUNICATION')
  const [group, setGroup] = useState<PersonaGroup>(initialMode === 'LESSON' ? 'special' : 'it')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [position, setPosition] = useState<string | null>(null)
  const [experience, setExperience] = useState<string>('1-2Y')
  const [scenario, setScenario] = useState<string | null>(null)
  const [cefr, setCefr] = useState<string>('B1')

  // Backend personas carry `difficulty` → used to lock ADVANCED ones for free users.
  const { data: backendPersonas = [] } = useQuery({
    queryKey: ['interview-personas'],
    queryFn: () => speakingApi.getPersonas(),
    staleTime: 300_000,
  })
  const lockedCodes = useMemo(
    () =>
      new Set(
        backendPersonas.filter((p) => p.difficulty === 'ADVANCED').map((p) => p.code.toUpperCase()),
      ),
    [backendPersonas],
  )

  const groups = useMemo(() => {
    if (mode === 'INTERVIEW') return PERSONA_GROUPS.filter((g) => g.id !== 'special')
    if (mode === 'LESSON') return PERSONA_GROUPS.filter((g) => g.id === 'special')
    return PERSONA_GROUPS
  }, [mode])

  const personas = useMemo(() => {
    let list = PERSONA_LIST.filter((p) => p.group === group)
    if (mode === 'INTERVIEW') list = list.filter((p) => p.supportsInterview)
    else if (mode === 'LESSON') list = list.filter((p) => p.supportsLesson)
    return list
  }, [group, mode])

  const selected = selectedId ? PERSONA_LIST.find((p) => p.id === selectedId) ?? null : null

  function switchMode(next: SpeakingSessionMode) {
    setMode(next)
    setSelectedId(null)
    setPosition(null)
    setScenario(null)
    // Snap group into the set valid for the new mode.
    if (next === 'LESSON') setGroup('special')
    else if (next === 'INTERVIEW' && group === 'special') setGroup('it')
  }

  function selectPersona(p: PersonaToken) {
    if (lockedCodes.has(p.id.toUpperCase()) && !isPro) return
    setSelectedId(p.id)
    setPosition(p.interviewPositions?.[0]?.label ?? null)
    setScenario(p.lessonScenarios?.[0]?.id ?? null)
  }

  const ready =
    !!selected &&
    (mode === 'INTERVIEW' ? !!position && !!experience : mode === 'LESSON' ? !!scenario : true)

  function start() {
    if (!selected || !ready) return
    const topic =
      mode === 'LESSON'
        ? selected.lessonScenarios?.find((s) => s.id === scenario)?.labelDe ?? scenario ?? 'Lektion'
        : mode === 'INTERVIEW'
          ? position ?? selected.role
          : 'Alltag'
    onStart({
      persona: selected,
      sessionMode: mode,
      topic,
      cefrLevel: mode === 'INTERVIEW' ? 'C1' : cefr,
      interviewPosition: mode === 'INTERVIEW' ? position ?? undefined : undefined,
      experienceLevel: mode === 'INTERVIEW' ? experience : undefined,
    })
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: space[12] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
        <ThemedText variant="displayLg">Luyện nói</ThemedText>
        <ThemedText variant="body" color="muted" style={{ marginTop: 2 }}>
          Chọn cách luyện và người đồng hành
        </ThemedText>
      </View>

      {/* Mode tabs — anchor cho coach mark speaking_intro (onboarding v1 §6) */}
      <SpotlightTarget
        id={SPOTLIGHT_TARGETS.speakingModeTabs}
        style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[5], marginTop: space[4] }}
      >
        {MODES.map((m) => {
          const active = mode === m.key
          return (
            <Pressable
              key={m.key}
              onPress={() => switchMode(m.key)}
              style={{
                flex: 1,
                paddingVertical: space[3],
                borderRadius: radius.lg,
                alignItems: 'center',
                gap: 4,
                backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                borderWidth: 1,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Icon icon={m.icon} size={20} color={active ? 'onAccent' : 'secondary'} />
              <ThemedText variant="label" style={{ color: active ? theme.colors.onAccent : theme.colors.textSecondary }}>
                {m.label}
              </ThemedText>
            </Pressable>
          )
        })}
      </SpotlightTarget>

      {/* Group chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space[5], gap: space[2], marginTop: space[4] }}
      >
        {groups.map((g) => {
          const active = group === g.id
          return (
            <Pressable
              key={g.id}
              onPress={() => {
                setGroup(g.id)
                setSelectedId(null)
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
                borderRadius: radius.full,
                backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
                borderWidth: 1,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Icon icon={GROUP_ICONS[g.id]} size={15} color={active ? 'accent' : 'secondary'} />
              <ThemedText
                variant="label"
                style={{ color: active ? theme.colors.accentText : theme.colors.textSecondary }}
              >
                {g.label}
              </ThemedText>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Persona grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space[3],
          paddingHorizontal: space[5],
          marginTop: space[4],
        }}
      >
        {personas.map((p) => (
          <PersonaCard
            key={p.id}
            persona={p}
            selected={selectedId === p.id}
            locked={lockedCodes.has(p.id.toUpperCase()) && !isPro}
            onPress={() => selectPersona(p)}
          />
        ))}
      </View>

      {/* Config + start */}
      {selected ? (
        <View
          style={{
            marginHorizontal: space[5],
            marginTop: space[5],
            padding: space[4],
            borderRadius: radius.xl,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: selected.accent + '55',
            gap: space[3],
          }}
        >
          <ThemedText variant="title">Thiết lập với {selected.name}</ThemedText>

          {mode === 'INTERVIEW' ? (
            <>
              <ConfigGroup label="Vị trí ứng tuyển">
                {(selected.interviewPositions ?? []).map((pos) => (
                  <ChoiceChip
                    key={pos.id}
                    label={pos.label}
                    active={position === pos.label}
                    accent={selected.accent}
                    onPress={() => setPosition(pos.label)}
                  />
                ))}
              </ConfigGroup>
              <ConfigGroup label="Kinh nghiệm">
                {EXPERIENCE.map((e) => (
                  <ChoiceChip
                    key={e.id}
                    label={e.label}
                    active={experience === e.id}
                    accent={selected.accent}
                    onPress={() => setExperience(e.id)}
                  />
                ))}
              </ConfigGroup>
            </>
          ) : mode === 'LESSON' ? (
            <ConfigGroup label="Chủ đề bài học">
              {(selected.lessonScenarios ?? []).map((s) => (
                <ChoiceChip
                  key={s.id}
                  label={s.label}
                  active={scenario === s.id}
                  accent={selected.accent}
                  onPress={() => setScenario(s.id)}
                />
              ))}
            </ConfigGroup>
          ) : (
            <ConfigGroup label="Trình độ">
              {CEFR_LEVELS.map((lv) => (
                <ChoiceChip
                  key={lv}
                  label={lv}
                  active={cefr === lv}
                  accent={selected.accent}
                  onPress={() => setCefr(lv)}
                />
              ))}
            </ConfigGroup>
          )}

          <Button label={`Bắt đầu với ${selected.name}`} onPress={start} loading={starting} disabled={!ready} />
        </View>
      ) : null}
    </ScrollView>
  )
}

function PersonaCard({
  persona,
  selected,
  locked,
  onPress,
}: {
  persona: PersonaToken
  selected: boolean
  locked: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} style={{ width: '47%', opacity: locked ? 0.6 : 1 }}>
      <MotiView
        animate={{ translateY: selected ? -4 : 0 }}
        transition={{ type: 'timing', duration: 280 }}
        style={{
          height: 290,
          borderRadius: radius.xl,
          overflow: 'hidden',
          backgroundColor: selected ? persona.accent + '1A' : theme.colors.surface,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? persona.accent : theme.colors.border,
        }}
      >
        {/* Bespoke / parametrized character */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 66,
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <View style={{ width: '90%', height: '96%' }}>
            <PersonaAvatar personaId={persona.id} expression={selected ? 'smiling' : 'neutral'} isTalking={false} />
          </View>
        </View>

        {/* Info panel */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space[3],
            paddingTop: space[2],
            paddingBottom: space[3],
            backgroundColor: theme.colors.surface,
            gap: 2,
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: persona.accent + '26',
              borderRadius: radius.full,
              paddingHorizontal: space[2],
              paddingVertical: 2,
              marginBottom: 2,
            }}
          >
            <ThemedText variant="caption" style={{ color: persona.accent, fontSize: 10 }} numberOfLines={1}>
              {persona.tag}
            </ThemedText>
          </View>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {persona.name}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: persona.accent }} numberOfLines={1}>
            {persona.role}
          </ThemedText>
        </View>

        {/* Badge */}
        {locked ? (
          <View style={{ position: 'absolute', top: space[2], right: space[2], backgroundColor: theme.colors.surfaceSunken, borderRadius: radius.full, padding: 5 }}>
            <Icon icon={Lock} size={14} color="faint" />
          </View>
        ) : selected ? (
          <View
            style={{
              position: 'absolute',
              top: space[2],
              right: space[2],
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: persona.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Check} size={16} color="onAccent" />
          </View>
        ) : null}
      </MotiView>
    </Pressable>
  )
}

function ConfigGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <ThemedText variant="label" color="muted">
        {label}
      </ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>
    </View>
  )
}

function ChoiceChip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string
  active: boolean
  accent: string
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space[3],
        paddingVertical: space[2],
        borderRadius: radius.full,
        backgroundColor: active ? accent + '22' : theme.colors.surfaceSunken,
        borderWidth: 1,
        borderColor: active ? accent : theme.colors.border,
      }}
    >
      <ThemedText variant="label" style={{ color: active ? accent : theme.colors.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  )
}
