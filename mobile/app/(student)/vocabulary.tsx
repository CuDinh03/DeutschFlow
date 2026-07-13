import { useState, useEffect, useRef } from 'react'
import { View, TextInput, FlatList, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Search, BookMarked, Plus, Check, Film, ChevronRight, Repeat, Layers, BarChart3 } from 'lucide-react-native'
import api from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { learningApi } from '@/lib/learningApi'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Pill,
  Caption,
  YellowSquare,
  AppHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  SelectableChip,
  Button,
  VocabGlyphTile,
} from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'

// Display shape used by WordRow.
interface Word {
  id: string
  word: string
  translation: string
  gender?: 'der' | 'die' | 'das'
  cefrLevel?: string
  srsStatus?: 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED'
}

// Backend WordListItem (camelCase record). base_form/meaning/article, not word/translation/gender.
interface RawWord {
  id: number
  baseForm: string
  meaning: string | null
  article?: string | null // 'der' | 'die' | 'das' (lowercase) for nouns
  cefrLevel?: string | null
  srsStatus?: Word['srsStatus']
}

function mapWord(r: RawWord): Word {
  const g = r.article === 'der' || r.article === 'die' || r.article === 'das' ? r.article : undefined
  return {
    id: String(r.id),
    word: r.baseForm,
    translation: r.meaning ?? '',
    gender: g,
    cefrLevel: r.cefrLevel ?? undefined,
    srsStatus: r.srsStatus,
  }
}

const STATUS_FILTERS = ['ALL', 'NEW', 'LEARNING', 'MASTERED'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const FILTER_LABEL: Record<StatusFilter, string> = {
  ALL: 'Tất cả',
  NEW: 'Mới',
  LEARNING: 'Đang học',
  MASTERED: 'Thuộc',
}

export default function VocabularyScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const debouncedSearch = useDebounce(search, 350)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['words', debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: '0', size: '30' })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
      // Backend WordListResponse wraps the list in `items` (not `content`) — reading the wrong
      // key silently yielded an empty list on every load.
      return api.get<{ items: RawWord[] }>(`/words?${params}`).then((r) => (r.data.items ?? []).map(mapWord))
    },
    staleTime: 30_000,
  })

  const words = data ?? []

  // SRS due count (real data) for the dashboard hero — /srs/due returns the due
  // queue; we count it (capped) rather than fabricating learning/mastered totals.
  const { data: dueCount = 0 } = useQuery({
    queryKey: ['srs-due-count'],
    queryFn: () => api.get<unknown[]>('/srs/due?limit=99').then((r) => (r.data ?? []).length),
    staleTime: 60_000,
  })

  const searchedRef = useRef(false)
  useEffect(() => {
    if (debouncedSearch.trim() && !searchedRef.current) {
      searchedRef.current = true
      trackFeatureAction('vocabulary_dictionary', 'started')
    }
  }, [debouncedSearch])

  return (
    <Screen edges={['top']}>
      <AppHeader title="Từ vựng" subtitle="Wortschatz · Spaced repetition" onBack={() => router.back()} />

      {/* SRS due hero (real /srs/due count) — the dashboard's primary call to review. */}
      {dueCount > 0 ? (
        <Card
          style={{
            marginHorizontal: space[5],
            marginBottom: space[3],
            backgroundColor: c.inkSurface,
            borderColor: c.inkSurface,
            gap: space[3],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 6 }}>
              <Caption color={c.accent}>Đến hạn ôn hôm nay</Caption>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                <ThemedText variant="displayLg" color="onInk">
                  {dueCount}
                </ThemedText>
                <ThemedText variant="body" style={{ color: c.onInkMuted }}>
                  thẻ
                </ThemedText>
              </View>
            </View>
            <Icon icon={Repeat} size={28} color="secondary" />
          </View>
          <Button
            variant="yellow"
            label={`Ôn ${dueCount} từ hôm nay`}
            onPress={() => router.push('/(student)/srs' as unknown as Href)}
          />
        </Card>
      ) : null}

      {/* Quick actions — flashcards + SRS stats (parity with na-vocab dashboard). */}
      <View style={{ flexDirection: 'row', gap: space[3], marginHorizontal: space[5], marginBottom: space[4] }}>
        <Card
          onPress={() => router.push('/(student)/srs' as unknown as Href)}
          accessibilityLabel="Học thẻ"
          style={{ flex: 1, gap: space[2] }}
        >
          <Icon icon={Layers} size={20} color="accent" />
          <ThemedText variant="bodyStrong">Học thẻ (vuốt)</ThemedText>
          <ThemedText variant="caption" color="muted">
            Vuốt biết / chưa biết
          </ThemedText>
        </Card>
        <Card
          onPress={() => router.push('/(student)/stats' as unknown as Href)}
          accessibilityLabel="Thống kê SRS"
          style={{ flex: 1, gap: space[2] }}
        >
          <Icon icon={BarChart3} size={20} color="accent" />
          <ThemedText variant="bodyStrong">Thống kê SRS</ThemedText>
          <ThemedText variant="caption" color="muted">
            Tiến độ ghi nhớ
          </ThemedText>
        </Card>
      </View>

      <View
        style={{
          marginHorizontal: space[5],
          marginBottom: space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        }}
      >
        <Icon icon={Search} size={16} color="muted" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm từ vựng..."
          placeholderTextColor={c.textFaint}
          style={{ flex: 1, color: c.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 15 }}
        />
      </View>

      {/* Editorial filter chips — active filter takes a solid accent fill */}
      <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[5], marginBottom: space[4] }}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f
          return (
            <SelectableChip
              key={f}
              label={FILTER_LABEL[f]}
              selected={active}
              onPress={() => setStatusFilter(f)}
            >
              <Pill label={FILTER_LABEL[f]} tone={active ? 'accent' : 'neutral'} solid={active} />
            </SelectableChip>
          )
        })}
      </View>

      {/* Video review entry — sharp paper card with the yellow-square motif */}
      <Card
        onPress={() => router.push('/(student)/video-lesson' as unknown as Href)}
        accessibilityLabel="Xem video ôn tập"
        style={{ marginHorizontal: space[5], marginBottom: space[5], borderColor: c.accentSoft }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: c.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Film} size={20} color="accent" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Caption color={c.accentText}>Video ôn tập</Caption>
            <ThemedText variant="bodyStrong">Xem từ vựng qua hình ảnh</ThemedText>
            <ThemedText variant="caption" color="muted">
              Hình ảnh + lồng tiếng Đức theo cấp độ
            </ThemedText>
          </View>
          <Icon icon={ChevronRight} size={18} color="muted" />
        </View>
      </Card>

      {/* Section eyebrow over the word list */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space[5],
          marginBottom: space[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <YellowSquare size={8} />
          <Caption>{statusFilter === 'ALL' ? 'Tất cả từ' : FILTER_LABEL[statusFilter]}</Caption>
        </View>
        {!isLoading && !isError ? (
          <ThemedText variant="caption" color="faint">
            {words.length} từ
          </ThemedText>
        ) : null}
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[2] }}>
          <Skeleton height={60} radius="lg" />
          <Skeleton height={60} radius="lg" />
          <Skeleton height={60} radius="lg" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={words}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[2] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={<EmptyState icon={BookMarked} title="Không tìm thấy từ vựng" message="Thử từ khoá hoặc bộ lọc khác." />}
          renderItem={({ item }) => <WordRow word={item} />}
        />
      )}
    </Screen>
  )
}

function WordRow({ word }: { word: Word }) {
  const c = useTheme().colors
  // Already in SRS if the backend says it's past NEW; otherwise the user can add it.
  const alreadyLearning = word.srsStatus != null && word.srsStatus !== 'NEW'
  const [added, setAdded] = useState(alreadyLearning)
  const [busy, setBusy] = useState(false)
  const done = added || alreadyLearning

  async function add() {
    if (done || busy) return
    setBusy(true)
    try {
      await learningApi.markWordLearned(word.id)
      setAdded(true)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      // leave as not-added; user can retry
    } finally {
      setBusy(false)
    }
  }

  // German article shown as a serif colored glyph (der=info, die=danger, das=success).
  const articleColor = word.gender ? c[word.gender] : c.textFaint

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {/* Icon slot (fixed) + article column (fixed). der/die/das stays a
            prominent, colour-coded, consistently-placed column — important for
            German — and both fixed widths keep the word column aligned. */}
        <View style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
          <VocabGlyphTile german={word.word} meaning={word.translation} size={36} />
        </View>
        <ThemedText
          style={{
            width: 30,
            fontFamily: fonts.displaySemi,
            fontSize: 15,
            color: articleColor,
          }}
        >
          {word.gender ?? '—'}
        </ThemedText>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
            <ThemedText variant="bodyStrong">{word.word}</ThemedText>
            {word.cefrLevel ? <Caption color={c.textFaint}>{word.cefrLevel}</Caption> : null}
          </View>
          <ThemedText variant="caption" color="muted">
            {word.translation}
          </ThemedText>
        </View>
        <SelectableChip
          label={done ? 'Đã thuộc' : 'Đánh dấu đã thuộc'}
          onPress={add}
          disabled={done || busy}
          hitSlop={6}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            borderRadius: radius.sm,
            paddingHorizontal: space[3],
            paddingVertical: 6,
            backgroundColor: done ? c.successSoft : c.accentSoft,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Icon icon={done ? Check : Plus} size={14} color={done ? 'success' : 'accent'} />
          <ThemedText variant="label" color={done ? 'success' : 'accent'}>
            {done ? 'Đã học' : 'Học'}
          </ThemedText>
        </SelectableChip>
      </View>
    </Card>
  )
}
