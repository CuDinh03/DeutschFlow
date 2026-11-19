import { useState, useEffect, useRef } from 'react'
import { View, TextInput, FlatList, RefreshControl, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Search, Check, ChevronRight } from 'lucide-react-native'
import api from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { learningApi } from '@/lib/learningApi'
import { fonts, radius, space, themeShadowStyle, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, EmptyState, ErrorState, Skeleton, SelectableChip, Button, VocabGlyphTile, GaGlyph } from '@/components/ui'
import { ArtBadge, Chip, HeroTitle, Rail, TopBar } from '@/components/learn/HocOnParts'
import { vocabStatusLabel } from '@/lib/hocOnUi'
import { useDebounce } from '@/hooks/useDebounce'
import { useBackToMainTab } from '@/hooks/useBackTo'

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

// Giao diện v3.4 (Đợt 6A, mẫu `vocab`): tiêu đề vệt vàng, lối "Thống kê SRS" ở góc phải, thẻ "Đến
// hạn ôn hôm nay" + nút Học thẻ, ô tìm, thẻ Video ôn tập, chip lọc cuộn ngang, danh sách từ liền một
// khung có viên mạo từ và nút tròn "đã thuộc". Truy vấn, lọc, đánh dấu đã thuộc giữ nguyên.
export default function VocabularyScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()
  const theme = useTheme()
  const c = theme.colors
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const debouncedSearch = useDebounce(search, 350)

  const { data, isLoading, isError, refetch } = useQuery({
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
  const pull = usePullRefresh(refetch)

  const words = data ?? []

  // SRS due count (real data) for the dashboard hero — /srs/due returns the due
  // queue; we count it (capped) rather than fabricating learning/mastered totals.
  const { data: dueCount = 0 } = useQuery({
    queryKey: ['srs-due-count'],
    // Backend /srs/due không nhận `limit` (tự cap phía server) — đừng gửi param chết (F-22).
    queryFn: () => api.get<unknown[]>('/srs/due').then((r) => (r.data ?? []).length),
    staleTime: 60_000,
  })

  const searchedRef = useRef(false)
  useEffect(() => {
    if (debouncedSearch.trim() && !searchedRef.current) {
      searchedRef.current = true
      trackFeatureAction('vocabulary_dictionary', 'started')
    }
  }, [debouncedSearch])

  // The whole page scrolls as ONE list: everything above the words lives in
  // ListHeaderComponent. A static header + nested FlatList squeezed the word
  // list into the leftover ~2 rows of viewport on small phones (QA build 15).
  // Kept as a JSX element (not a component) so the TextInput keeps focus
  // across re-renders.
  const listHeader = (
    <View style={{ paddingHorizontal: space[5] }}>
      <HeroTitle mark="vựng" lead="Từ" style={{ marginTop: space[4] }} />
      <ThemedText variant="caption" color="muted" style={{ marginTop: space[1] }}>
        Lặp lại ngắt quãng: ôn đúng lúc sắp quên.
      </ThemedText>

      {/* Thẻ đến hạn (đếm thật từ /srs/due) — lối chính vào ôn thẻ. */}
      <View
        style={[
          {
            marginTop: space[4],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[4],
            padding: space[4],
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
          },
          themeShadowStyle(theme.shadow.card),
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="caption" color="muted">
            Đến hạn ôn hôm nay
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
            <ThemedText variant="displayLg" style={{ fontSize: 40, lineHeight: 44 }}>
              {dueCount}
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              thẻ
            </ThemedText>
          </View>
        </View>
        <Button
          size="sm"
          fullWidth={false}
          label="Học thẻ"
          onPress={() => router.push('/(student)/srs' as unknown as Href)}
        />
      </View>

      <View
        style={{
          marginTop: space[3],
          height: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          backgroundColor: c.surface,
          borderWidth: 1.5,
          borderColor: c.borderStrong,
          borderRadius: radius.sm,
          paddingHorizontal: space[4],
        }}
      >
        <Icon icon={Search} size={18} color="muted" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm từ vựng…"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Tìm từ vựng"
          style={{ flex: 1, color: c.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 16 }}
        />
      </View>

      {/* Lối vào Video ôn tập. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xem video ôn tập"
        onPress={() => router.push({ pathname: '/(student)/video-lesson', params: { from: 'vocabulary' } } as unknown as Href)}
        style={({ pressed }) => [
          {
            marginTop: space[3],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[3] + 2,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
          themeShadowStyle(theme.shadow.card),
        ]}
      >
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <GaGlyph name="video" size={24} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="title">Video ôn tập</ThemedText>
          <ThemedText variant="caption" color="muted">
            Xem từ vựng qua hình ảnh
          </ThemedText>
        </View>
        <Icon icon={ChevronRight} size={18} color="faint" />
      </Pressable>

      <Rail style={{ marginTop: space[4] }}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f} label={FILTER_LABEL[f]} on={statusFilter === f} onPress={() => setStatusFilter(f)} />
        ))}
      </Rail>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space[4], marginBottom: space[2] }}>
        <ThemedText variant="title" accessibilityRole="header">
          {statusFilter === 'ALL' ? 'Tất cả từ' : FILTER_LABEL[statusFilter]}
        </ThemedText>
        {!isLoading && !isError ? (
          <ThemedText variant="caption" color="muted">
            {words.length} từ
          </ThemedText>
        ) : null}
      </View>
    </View>
  )

  return (
    <Screen edges={['top']}>
      <TopBar
        onBack={goBack}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thống kê SRS"
            hitSlop={12}
            onPress={() => router.push('/(student)/stats' as unknown as Href)}
          >
            <ThemedText variant="label" color="info">
              Thống kê SRS
            </ThemedText>
          </Pressable>
        }
      />

      <FlatList
        data={isLoading || isError ? [] : words}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: space[6] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={() => void pull.onRefresh()}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: space[5], gap: space[2] }}>
              <Skeleton height={56} radius="md" />
              <Skeleton height={56} radius="md" />
              <Skeleton height={56} radius="md" />
            </View>
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <EmptyState glyph="srs" title="Không tìm thấy từ vựng" message="Thử từ khoá hoặc bộ lọc khác." />
          )
        }
        renderItem={({ item, index }) => (
          <WordRow word={item} first={index === 0} last={index === words.length - 1} />
        )}
      />
    </Screen>
  )
}

/**
 * Một hàng của danh sách từ (mẫu `.list .li`). Các hàng ghép thành một khung liền: hàng đầu bo góc
 * trên, hàng cuối bo góc dưới, hàng sau có đường kẻ trên. Nút tròn bên phải = "đã thuộc" (mẫu `.known`).
 */
function WordRow({ word, first, last }: { word: Word; first: boolean; last: boolean }) {
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

  const status = vocabStatusLabel(word.srsStatus)
  const sub = [word.translation, status].filter(Boolean).join(' · ')

  return (
    <View
      style={{
        marginHorizontal: space[5],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 56,
        paddingVertical: 10,
        paddingHorizontal: space[4],
        backgroundColor: c.surface,
        borderColor: c.border,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderTopLeftRadius: first ? radius.md : 0,
        borderTopRightRadius: first ? radius.md : 0,
        borderBottomLeftRadius: last ? radius.md : 0,
        borderBottomRightRadius: last ? radius.md : 0,
      }}
    >
      {/* Ô mạo từ cố định 40pt: từ không phải danh từ hiện ô biểu tượng (nếu có) để cột chữ thẳng hàng. */}
      <View style={{ width: 40, alignItems: 'center' }}>
        {word.gender ? <ArtBadge gender={word.gender} small /> : <VocabGlyphTile german={word.word} meaning={word.translation} size={28} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
          <ThemedText variant="body" style={{ fontFamily: fonts.bodyMedium }} accessibilityLanguage="de-DE">
            {word.word}
          </ThemedText>
          {word.cefrLevel ? (
            <ThemedText variant="caption" color="muted">
              {word.cefrLevel}
            </ThemedText>
          ) : null}
        </View>
        {sub ? (
          <ThemedText variant="caption" color="muted">
            {sub}
          </ThemedText>
        ) : null}
      </View>
      <SelectableChip
        label={done ? 'Đã thuộc' : 'Đánh dấu đã thuộc'}
        selected={done}
        onPress={add}
        disabled={done || busy}
        hitSlop={6}
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: done ? c.success : c.borderStrong,
          backgroundColor: done ? c.success : 'transparent',
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Icon icon={Check} size={16} color={done ? 'onInk' : 'faint'} />
      </SelectableChip>
    </View>
  )
}
