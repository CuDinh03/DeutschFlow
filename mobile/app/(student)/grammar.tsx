import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Pressable } from 'react-native'
import { useQuery, useQueries } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { ChevronDown, ChevronUp, Check, Film, Lock } from 'lucide-react-native'
import api from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, SectionHeader, Caption, Skeleton, ErrorState } from '@/components/ui'
import { mapGrammarTopic, type GrammarTopic, type RawGrammarTopic } from '@/lib/grammarApi'
import { skillTreeApi } from '@/lib/skillTreeApi'
import { levelsFromTree, type CefrLevelState, type LevelState } from '@/lib/levelState'

// Minimal shape of a useQueries result element the level block reads (avoids importing
// the full UseQueryResult generic; the real element is structurally compatible).
interface TopicQueryLike {
  data?: GrammarTopic[]
  isLoading: boolean
  isError: boolean
  refetch: () => unknown
}

const CASES = [
  { key: 'nominativ', label: 'Nominativ', desc: 'Chủ ngữ (Wer? Was?)' },
  { key: 'akkusativ', label: 'Akkusativ', desc: 'Tân ngữ trực tiếp (Wen? Was?)' },
  { key: 'dativ', label: 'Dativ', desc: 'Tân ngữ gián tiếp (Wem?)' },
  { key: 'genitiv', label: 'Genitiv', desc: 'Sở hữu (Wessen?)' },
] as const

const ARTICLE_TABLE = {
  nominativ: { der: 'der', die: 'die', das: 'das', plural: 'die' },
  akkusativ: { der: 'den', die: 'die', das: 'das', plural: 'die' },
  dativ: { der: 'dem', die: 'der', das: 'dem', plural: 'den' },
  genitiv: { der: 'des', die: 'der', das: 'des', plural: 'der' },
}

const TABLE_HEADERS = ['', 'mask. (der)', 'fem. (die)', 'neut. (das)', 'Plural']

// Per-column gender tint for the declension table (index-aligned with the
// header/form columns: 0=row label, 1=der, 2=die, 3=das, 4=plural).
type ThemeColors = ReturnType<typeof useTheme>['colors']
const GENDER_HEX: ((c: ThemeColors) => string)[] = [
  (c) => c.textMuted,
  (c) => c.der,
  (c) => c.die,
  (c) => c.das,
  (c) => c.textSecondary,
]

export default function GrammarScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [expandedCase, setExpandedCase] = useState<string | null>('nominativ')

  const startedRef = useRef(false)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      trackFeatureAction('grammar', 'started')
    }
  }, [])

  // Which CEFR levels the learner's roadmap spans + their unlock state, derived from the
  // already-cached skill tree (no extra /roadmap fetch). Grammar is gated to match: levels
  // above the current one are shown dimmed and locked ("Mở khi đạt …"); the Kasus reference
  // table above stays open for everyone.
  const treeQuery = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => skillTreeApi.getMySkillTree(),
    staleTime: 120_000,
  })
  const levels = useMemo<CefrLevelState[]>(() => {
    const ls = levelsFromTree(treeQuery.data ?? [])
    if (ls.length > 0) return ls
    // Only fall back to a lone A1 when the tree genuinely loaded empty (a new learner). On a
    // fetch error we keep this empty and render an error+retry branch below, so a returning
    // B1/B2 learner is never silently collapsed to a single "A1" block with no way to recover.
    return treeQuery.isSuccess ? [{ level: 'A1', state: 'current' }] : []
  }, [treeQuery.data, treeQuery.isSuccess])

  // One topics query per level, run in parallel (bounded by the ≤~4 CEFR levels a tree spans).
  const topicQueries = useQueries({
    queries: levels.map((l) => ({
      queryKey: ['grammar-topics', l.level],
      queryFn: () =>
        api
          .get<RawGrammarTopic[]>('/grammar/syllabus/topics', { params: { cefrLevel: l.level } })
          .then((r) => r.data.map(mapGrammarTopic)),
      staleTime: 5 * 60_000,
    })),
  })
  const topicByLevel = new Map(levels.map((l, i) => [l.level, topicQueries[i] as TopicQueryLike]))
  const isFetching = treeQuery.isFetching || topicQueries.some((q) => q.isFetching)
  const refetchAll = () => {
    void treeQuery.refetch()
    topicQueries.forEach((q) => void q.refetch())
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Ngữ pháp tiếng Đức" onBack={() => router.back()} />

      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingBottom: space[8] }}
        refreshing={isFetching && !treeQuery.isLoading}
        onRefresh={refetchAll}
      >
        {/* Editorial ink hero — the Kasus system is the conceptual anchor of this screen */}
        <View style={{ paddingHorizontal: space[5], marginTop: space[1], marginBottom: space[5] }}>
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
            <Caption color={c.accent}>Grammatik · 4 Kasus</Caption>
            <ThemedText variant="display" style={{ color: c.onInk, marginTop: space[2] }}>
              Bảng cách tiếng Đức
            </ThemedText>
            <ThemedText variant="caption" style={{ color: c.onInkMuted, marginTop: space[2] }}>
              Mỗi danh từ đổi mạo từ theo cách. Chạm vào từng cách để xem bảng chia der / die / das.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[4] }}>
              <DeclLegend label="der" tone="der" />
              <DeclLegend label="die" tone="die" />
              <DeclLegend label="das" tone="das" />
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: space[5] }}>
          <Caption style={{ marginBottom: space[1] }}>Kasus</Caption>
          <SectionHeader title="Bảng cách" />
        </View>

        {CASES.map((kasus) => {
          const isOpen = expandedCase === kasus.key
          const row = ARTICLE_TABLE[kasus.key as keyof typeof ARTICLE_TABLE]
          return (
            <Card
              key={kasus.key}
              padded={false}
              onPress={() => setExpandedCase(isOpen ? null : kasus.key)}
              style={{ marginHorizontal: space[5], marginBottom: space[2], overflow: 'hidden' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[4] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.sm,
                      backgroundColor: isOpen ? c.accentSoft : c.surfaceSunken,
                      borderWidth: 1,
                      borderColor: isOpen ? c.accentSoft : c.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ThemedText variant="title" color={isOpen ? 'accent' : 'secondary'}>
                      {kasus.key.slice(0, 1).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={{ gap: 2 }}>
                    <ThemedText variant="bodyStrong">{kasus.label}</ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {kasus.desc}
                    </ThemedText>
                  </View>
                </View>
                <Icon icon={isOpen ? ChevronUp : ChevronDown} size={18} color="muted" />
              </View>

              {isOpen ? (
                <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
                  <View
                    style={{
                      backgroundColor: c.surfaceSunken,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: c.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.borderStrong }}>
                      {TABLE_HEADERS.map((h, i) => (
                        <View key={i} style={{ flex: 1, paddingVertical: space[2], paddingHorizontal: space[1] }}>
                          <ThemedText variant="caption" align="center" style={{ color: GENDER_HEX[i](c) }}>
                            {h}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, paddingVertical: space[3], paddingHorizontal: space[1] }}>
                        <ThemedText variant="caption" color="muted" align="center">
                          best.
                        </ThemedText>
                      </View>
                      {[row.der, row.die, row.das, row.plural].map((v, i) => (
                        <View key={i} style={{ flex: 1, paddingVertical: space[3], paddingHorizontal: space[1] }}>
                          <ThemedText
                            variant="title"
                            align="center"
                            style={{ color: GENDER_HEX[i](c) }}
                          >
                            {v}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Video: ${kasus.label}`}
                    onPress={() =>
                      router.push({
                        pathname: '/(student)/video-lesson',
                        params: { caseName: kasus.key, title: `Video: ${kasus.label}` },
                      } as unknown as Href)
                    }
                    style={{
                      marginTop: space[3],
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: space[2],
                      paddingVertical: space[3],
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: c.accentSoft,
                      backgroundColor: c.accentSoft,
                    }}
                  >
                    <Icon icon={Film} size={16} color="accent" />
                    <ThemedText variant="label" color="accent">
                      Xem video ngữ pháp
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          )
        })}

        {treeQuery.isLoading ? (
          <View style={{ paddingHorizontal: space[5], marginTop: space[5], gap: space[2] }}>
            <Skeleton height={72} radius="2xl" />
            <Skeleton height={72} radius="2xl" />
          </View>
        ) : treeQuery.isError && !treeQuery.data ? (
          <View style={{ marginTop: space[4] }}>
            <ErrorState
              title="Không tải được lộ trình"
              message="Bảng cách vẫn xem được. Kéo xuống hoặc thử lại để tải bài học ngữ pháp theo cấp."
              onRetry={refetchAll}
            />
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
              <Caption style={{ marginBottom: space[1] }}>Grammatik</Caption>
              <SectionHeader title="Bài học ngữ pháp" />
            </View>
            {levels.map((l) => (
              <LevelBlock key={l.level} level={l.level} state={l.state} query={topicByLevel.get(l.level)} />
            ))}
          </>
        )}
      </Screen>
    </Screen>
  )
}

// One CEFR level's grammar lessons. Unlocked levels (done/current) list their topics; a
// locked level is dimmed with a "Mở khi đạt {level}" lock and lists any authored topics as a
// disabled teaser (empty higher levels just show the header). The gate is visual-only — the
// topic cards aren't interactive, so nothing needs to block navigation.
function LevelBlock({ level, state, query }: { level: string; state: LevelState; query?: TopicQueryLike }) {
  const locked = state === 'locked'
  const topics = query?.data ?? []
  const tone = state === 'done' ? 'success' : state === 'current' ? 'accent' : 'neutral'
  return (
    <View style={{ marginTop: space[4], opacity: locked ? 0.55 : 1 }}>
      <View
        style={{
          paddingHorizontal: space[5],
          marginBottom: space[2],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
        }}
      >
        <Pill label={level} tone={tone} />
        {locked ? (
          <>
            <Icon icon={Lock} size={13} color="faint" />
            <ThemedText variant="caption" color="faint">
              Mở khi đạt {level}
            </ThemedText>
          </>
        ) : (
          <ThemedText variant="caption" color="muted">
            {state === 'done' ? 'Đã hoàn thành' : 'Đang học'}
          </ThemedText>
        )}
      </View>

      {query?.isLoading ? (
        <View style={{ paddingHorizontal: space[5] }}>
          <Skeleton height={64} radius="2xl" />
        </View>
      ) : query?.isError && !locked ? (
        <View style={{ paddingHorizontal: space[5], flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <ThemedText variant="caption" color="muted">
            Không tải được bài học.
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Thử lại" onPress={() => query.refetch()}>
            <ThemedText variant="label" color="accent">
              Thử lại
            </ThemedText>
          </Pressable>
        </View>
      ) : topics.length > 0 ? (
        topics.map((topic) => <TopicCard key={topic.id} topic={topic} />)
      ) : !locked ? (
        <View style={{ paddingHorizontal: space[5] }}>
          <ThemedText variant="caption" color="faint">
            Chưa có bài học cho cấp này.
          </ThemedText>
        </View>
      ) : null}
    </View>
  )
}

function TopicCard({ topic }: { topic: GrammarTopic }) {
  return (
    <Card style={{ marginHorizontal: space[5], marginBottom: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] }}>
        <View style={{ flex: 1, gap: space[1] }}>
          <ThemedText variant="bodyStrong">{topic.title}</ThemedText>
          {topic.summary ? (
            <ThemedText variant="caption" color="muted">
              {topic.summary}
            </ThemedText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: space[2] }}>
          <Pill label={topic.cefrLevel} tone="neutral" />
          {topic.isCompleted ? <Pill label="Xong" tone="success" icon={Check} /> : null}
        </View>
      </View>
    </Card>
  )
}

// Small declension legend chip used on the ink hero (der = blue, die = red,
// das = green) — the gender-colour motif that recurs in the Kasus tables.
function DeclLegend({ label, tone }: { label: string; tone: 'der' | 'die' | 'das' }) {
  const c = useTheme().colors
  const hex = tone === 'der' ? c.der : tone === 'die' ? c.die : c.das
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[2],
        paddingVertical: 5,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c.onInkMuted,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: hex }} />
      <ThemedText variant="caption" style={{ color: c.onInk }}>
        {label}
      </ThemedText>
    </View>
  )
}
