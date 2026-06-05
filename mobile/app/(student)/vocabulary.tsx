import { useState, useEffect, useRef } from 'react'
import { View, TextInput, FlatList, Pressable, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Search, BookMarked, Plus, Check, Film, ChevronRight } from 'lucide-react-native'
import api from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { learningApi } from '@/lib/learningApi'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
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
      return api.get<{ content: RawWord[] }>(`/words?${params}`).then((r) => (r.data.content ?? []).map(mapWord))
    },
    staleTime: 30_000,
  })

  const words = data ?? []

  const searchedRef = useRef(false)
  useEffect(() => {
    if (debouncedSearch.trim() && !searchedRef.current) {
      searchedRef.current = true
      trackFeatureAction('vocabulary_dictionary', 'started')
    }
  }, [debouncedSearch])

  return (
    <Screen edges={['top']}>
      <AppHeader title="Từ vựng" onBack={() => router.back()} />

      <View
        style={{
          marginHorizontal: space[5],
          marginBottom: space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          backgroundColor: c.surfaceSunken,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.lg,
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

      <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[5], marginBottom: space[4] }}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f
          return (
            <Pressable
              key={f}
              onPress={() => setStatusFilter(f)}
              style={{
                paddingHorizontal: space[3],
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: active ? c.accent : c.surfaceSunken,
                borderWidth: active ? 0 : 1,
                borderColor: c.border,
              }}
            >
              <ThemedText variant="label" color={active ? 'onAccent' : 'muted'}>
                {FILTER_LABEL[f]}
              </ThemedText>
            </Pressable>
          )
        })}
      </View>

      <Pressable
        onPress={() => router.push('/(student)/video-lesson' as unknown as Href)}
        style={{
          marginHorizontal: space[5],
          marginBottom: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          backgroundColor: c.accentSoft,
          borderRadius: radius.lg,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        }}
      >
        <Icon icon={Film} size={20} color="accent" />
        <View style={{ flex: 1 }}>
          <ThemedText variant="bodyStrong" color="accent">
            Xem video ôn tập
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            Hình ảnh + lồng tiếng Đức theo cấp độ
          </ThemedText>
        </View>
        <Icon icon={ChevronRight} size={18} color="accent" />
      </Pressable>

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

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
          {word.gender ? <Pill label={word.gender} tone={word.gender} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bodyStrong">{word.word}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {word.translation}
            </ThemedText>
          </View>
        </View>
        {word.cefrLevel ? (
          <ThemedText variant="caption" color="faint">
            {word.cefrLevel}
          </ThemedText>
        ) : null}
        <Pressable
          onPress={add}
          disabled={done || busy}
          hitSlop={6}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            borderRadius: radius.full,
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
        </Pressable>
      </View>
    </Card>
  )
}
