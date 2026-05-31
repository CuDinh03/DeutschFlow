import { useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Search, ArrowLeft, BookMarked } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'
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

export default function VocabularyScreen() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL')
  const debouncedSearch = useDebounce(search, 350)

  const { data, isLoading } = useQuery({
    queryKey: ['words', debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: '0', size: '30' })
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (statusFilter !== 'ALL') params.set('status', statusFilter.toLowerCase())
      return api.get<{ content: Word[] }>(`/words?${params}`).then(r => r.data.content)
    },
    staleTime: 30_000,
  })

  const words = data ?? []

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Từ vựng</Text>
      </View>

      {/* Search */}
      <View className="mx-5 mb-3 flex-row items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3">
        <Search size={16} color={Colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm từ vựng..."
          placeholderTextColor="#4A5568"
          className="flex-1 text-white text-sm"
        />
      </View>

      {/* Status filter chips */}
      <View className="flex-row gap-2 px-5 mb-4">
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full ${statusFilter === f ? 'bg-[#F5C842]' : 'bg-[#1A1A1A] border border-[#2A2A2A]'}`}
          >
            <Text className={`text-xs font-semibold ${statusFilter === f ? 'text-[#0D0D0D]' : 'text-[#64748B]'}`}>
              {f === 'ALL' ? 'Tất cả' : f === 'NEW' ? 'Mới' : f === 'LEARNING' ? 'Đang học' : 'Thuộc'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.yellow} />
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center pt-12">
              <BookMarked size={32} color={Colors.muted} />
              <Text className="text-[#64748B] text-sm mt-3">Không tìm thấy từ vựng</Text>
            </View>
          }
          renderItem={({ item }) => {
            const genderColor = item.gender === 'der' ? Colors.der : item.gender === 'die' ? Colors.die : item.gender === 'das' ? Colors.das : '#64748B'
            return (
              <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  {item.gender && (
                    <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: `${genderColor}22` }}>
                      <Text className="text-xs font-bold" style={{ color: genderColor }}>{item.gender}</Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-white font-semibold text-sm">{item.word}</Text>
                    <Text className="text-[#64748B] text-xs">{item.translation}</Text>
                  </View>
                </View>
                {item.cefrLevel && (
                  <Text className="text-[#2A2A2A] text-xs font-bold">{item.cefrLevel}</Text>
                )}
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}
