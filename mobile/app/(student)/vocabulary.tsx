import { useState } from 'react'
import { View, TextInput, FlatList, Pressable, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Search, BookMarked } from 'lucide-react-native'
import api from '@/lib/api'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { useDebounce } from '@/hooks/useDebounce'

interface Word {
  id: string
  word: string
  translation: string
  gender?: 'der' | 'die' | 'das'
  cefrLevel?: string
  srsStatus?: 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED'
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
      return api.get<{ content: Word[] }>(`/words?${params}`).then((r) => r.data.content)
    },
    staleTime: 30_000,
  })

  const words = data ?? []

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
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
                  {item.gender ? <Pill label={item.gender} tone={item.gender} /> : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="bodyStrong">{item.word}</ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {item.translation}
                    </ThemedText>
                  </View>
                </View>
                {item.cefrLevel ? (
                  <ThemedText variant="caption" color="faint">
                    {item.cefrLevel}
                  </ThemedText>
                ) : null}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  )
}
