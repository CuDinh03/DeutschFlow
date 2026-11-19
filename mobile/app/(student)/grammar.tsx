import { useEffect, useRef, useMemo } from 'react'
import { View, Pressable } from 'react-native'
import { useQuery, useQueries } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router, type Href } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import api from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { radius, space, themeShadowStyle, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, Skeleton, ErrorState } from '@/components/ui'
import { ArtBadge, Badge, GlyphTile, HeroTitle, ListCard, ListItem, SectionHead, TopBar } from '@/components/learn/HocOnParts'
import { mapGrammarTopic, type GrammarTopic, type RawGrammarTopic } from '@/lib/grammarApi'
import { skillTreeApi } from '@/lib/skillTreeApi'
import { levelsFromTree, type CefrLevelState, type LevelState } from '@/lib/levelState'
import { useBackToMainTab } from '@/hooks/useBackTo'

// Minimal shape of a useQueries result element the level block reads (avoids importing
// the full UseQueryResult generic; the real element is structurally compatible).
interface TopicQueryLike {
  data?: GrammarTopic[]
  isLoading: boolean
  isError: boolean
  refetch: () => unknown
}

const CASES = [
  { key: 'nominativ', label: 'Nominativ', short: 'Nom.', role: 'chủ ngữ', desc: 'Chủ ngữ (Wer? Was?)' },
  { key: 'akkusativ', label: 'Akkusativ', short: 'Akk.', role: 'tân ngữ trực tiếp', desc: 'Tân ngữ trực tiếp (Wen? Was?)' },
  { key: 'dativ', label: 'Dativ', short: 'Dat.', role: 'tân ngữ gián tiếp', desc: 'Tân ngữ gián tiếp (Wem?)' },
  { key: 'genitiv', label: 'Genitiv', short: 'Gen.', role: 'sở hữu', desc: 'Sở hữu (Wessen?)' },
] as const

const ARTICLE_TABLE = {
  nominativ: { der: 'der', die: 'die', das: 'das', plural: 'die' },
  akkusativ: { der: 'den', die: 'die', das: 'das', plural: 'die' },
  dativ: { der: 'dem', die: 'der', das: 'dem', plural: 'den' },
  genitiv: { der: 'des', die: 'der', das: 'des', plural: 'der' },
}

// Giao diện v3.4 (Đợt 6A, mẫu `grammar`): tiêu đề vệt vàng, thẻ mực có bảng 4 Kasus đầy đủ
// (m/f/n/Pl.), video theo từng cách thành danh sách, bài học ngữ pháp theo cấp thành danh sách có ô
// biểu tượng (xong / đang mở / khoá). Truy vấn, khoá theo cấp, điều hướng video giữ nguyên.
export default function GrammarScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()
  const theme = useTheme()
  const c = theme.colors

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
  const pull = usePullRefresh(async () => {
    await Promise.all([treeQuery.refetch(), ...topicQueries.map((q) => q.refetch())])
  })
  const refetchAll = () => {
    void treeQuery.refetch()
    topicQueries.forEach((q) => void q.refetch())
  }

  return (
    <Screen edges={['top']}>
      <TopBar onBack={goBack} />

      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], paddingTop: space[4] }}
        refreshing={pull.refreshing}
        onRefresh={() => void pull.onRefresh()}
      >
        <HeroTitle lead="Ngữ pháp" mark="tiếng Đức" />

        {/* Thẻ mực: bảng mạo từ xác định theo 4 cách — mở cho mọi người, không khoá theo cấp. */}
        <View
          style={[
            { marginTop: space[4], backgroundColor: c.inkSurface, borderRadius: radius.lg, padding: space[5] },
            themeShadowStyle(theme.shadow.card),
          ]}
        >
          <ThemedText variant="label" style={{ color: c.onInkMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
            Ngữ pháp · 4 Kasus
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: space[3] }}>
            <ArtBadge gender="der" />
            <ArtBadge gender="die" />
            <ArtBadge gender="das" />
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: c.onInkMuted, justifyContent: 'center' }}>
              <ThemedText variant="caption" style={{ color: c.onInk, fontWeight: '700', fontSize: 13 }}>
                die (Pl.)
              </ThemedText>
            </View>
          </View>
          <KasusTable />
        </View>

        <SectionHead title="Video theo cách" right="Bảng chia + lồng tiếng" />
        <ListCard>
          {CASES.map((kasus, i) => (
            <ListItem
              key={kasus.key}
              first={i === 0}
              accessibilityLabel={`Video: ${kasus.label}`}
              onPress={() =>
                router.push({
                  pathname: '/(student)/video-lesson',
                  params: { caseName: kasus.key, title: `Video: ${kasus.label}`, from: 'grammar' },
                } as unknown as Href)
              }
            >
              <GlyphTile name="video" />
              <View style={{ flex: 1, gap: 1 }}>
                <ThemedText variant="body" style={{ fontWeight: '500' }} accessibilityLanguage="de-DE">
                  {kasus.label}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {kasus.desc}
                </ThemedText>
              </View>
              <Icon icon={ChevronRight} size={18} color="faint" />
            </ListItem>
          ))}
        </ListCard>

        {treeQuery.isLoading ? (
          <View style={{ marginTop: space[6], gap: space[2] }}>
            <Skeleton height={56} radius="md" />
            <Skeleton height={56} radius="md" />
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
            <SectionHead title="Bài học ngữ pháp" right={levels.find((l) => l.state === 'current')?.level} />
            <View style={{ gap: space[4] }}>
              {levels.map((l) => (
                <LevelBlock key={l.level} level={l.level} state={l.state} query={topicByLevel.get(l.level)} />
              ))}
            </View>
          </>
        )}
      </Screen>
    </Screen>
  )
}

/** Bảng mẫu `.kasus`: hàng = cách, cột = giống đực/cái/trung/số nhiều, ô tô theo màu giống. */
function KasusTable() {
  const c = useTheme().colors
  const cols = [
    { key: 'der', head: 'm', bg: c.der },
    { key: 'die', head: 'f', bg: c.die },
    { key: 'das', head: 'n', bg: c.das },
    { key: 'plural', head: 'Pl.', bg: null },
  ] as const
  return (
    <View style={{ marginTop: space[4], gap: 6 }} accessibilityLabel="Bảng mạo từ xác định theo bốn cách">
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ flex: 1.6 }} />
        {cols.map((col) => (
          <ThemedText key={col.key} variant="caption" align="center" style={{ flex: 1, color: c.onInkMuted }}>
            {col.head}
          </ThemedText>
        ))}
      </View>
      {CASES.map((kasus) => {
        const row = ARTICLE_TABLE[kasus.key]
        return (
          <View
            key={kasus.key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            accessible
            accessibilityLabel={`${kasus.label}, ${kasus.role}: ${row.der}, ${row.die}, ${row.das}, số nhiều ${row.plural}`}
          >
            <View style={{ flex: 1.6 }}>
              <ThemedText variant="title" style={{ color: c.onInk, fontSize: 15, lineHeight: 18 }}>
                {kasus.short}
              </ThemedText>
              <ThemedText variant="caption" style={{ color: c.onInkMuted, fontSize: 11, lineHeight: 14 }}>
                {kasus.role}
              </ThemedText>
            </View>
            {cols.map((col) => (
              <View
                key={col.key}
                style={{
                  flex: 1,
                  height: 32,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: col.bg ?? 'transparent',
                  borderWidth: col.bg ? 0 : 1,
                  borderColor: c.onInkMuted,
                }}
              >
                <ThemedText variant="bodyStrong" style={{ color: c.onInk, fontSize: 14 }} accessibilityLanguage="de-DE">
                  {row[col.key]}
                </ThemedText>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

// One CEFR level's grammar lessons. Unlocked levels (done/current) list their topics; a
// locked level is dimmed with a "Mở khi đạt {level}" lock and lists any authored topics as a
// disabled teaser (empty higher levels just show the header). The gate is visual-only — the
// topic rows aren't interactive, so nothing needs to block navigation.
function LevelBlock({ level, state, query }: { level: string; state: LevelState; query?: TopicQueryLike }) {
  const locked = state === 'locked'
  const topics = query?.data ?? []
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Badge label={level} tone={state === 'done' ? 'green' : state === 'current' ? 'yellow' : 'neutral'} />
        <ThemedText variant="caption" color="muted">
          {locked ? `Mở khi đạt ${level}` : state === 'done' ? 'Đã hoàn thành' : 'Đang học'}
        </ThemedText>
      </View>

      {query?.isLoading ? (
        <Skeleton height={56} radius="md" />
      ) : query?.isError && !locked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <ThemedText variant="caption" color="muted">
            Không tải được bài học.
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Thử lại" hitSlop={12} onPress={() => query.refetch()}>
            <ThemedText variant="label" color="info">
              Thử lại
            </ThemedText>
          </Pressable>
        </View>
      ) : topics.length > 0 ? (
        <ListCard>
          {topics.map((topic, i) => (
            <TopicRow key={topic.id} topic={topic} first={i === 0} locked={locked} level={level} />
          ))}
        </ListCard>
      ) : !locked ? (
        <ThemedText variant="caption" color="muted">
          Chưa có bài học cho cấp này.
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Hàng bài ngữ pháp (mẫu `.li` + `.gi`): xong = dấu hoàn thành, cấp khoá = ổ khoá. */
function TopicRow({ topic, first, locked, level }: { topic: GrammarTopic; first: boolean; locked: boolean; level: string }) {
  const sub = locked ? `Mở khi đạt ${level}` : topic.isCompleted ? 'Đã hoàn thành' : topic.summary
  return (
    <ListItem first={first}>
      <GlyphTile name={locked ? 'khoa' : topic.isCompleted ? 'hoanthanh' : 'nguphap'} tone={topic.isCompleted && !locked ? 'green' : 'neutral'} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText variant="body" color={locked ? 'muted' : 'primary'} style={{ fontWeight: '500' }}>
          {topic.title}
        </ThemedText>
        {sub ? (
          <ThemedText variant="caption" color="muted" numberOfLines={2}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
    </ListItem>
  )
}
