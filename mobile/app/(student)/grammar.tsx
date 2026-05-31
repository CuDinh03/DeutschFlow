import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface GrammarTopic {
  id: string
  title: string
  cefrLevel: string
  category: string
  summary: string
  isCompleted?: boolean
}

const CASES = [
  { key: 'nominativ', label: 'Nominativ', desc: 'Chủ ngữ (Wer? Was?)', color: Colors.blue },
  { key: 'akkusativ', label: 'Akkusativ', desc: 'Tân ngữ trực tiếp (Wen? Was?)', color: Colors.green },
  { key: 'dativ', label: 'Dativ', desc: 'Tân ngữ gián tiếp (Wem?)', color: Colors.yellow },
  { key: 'genitiv', label: 'Genitiv', desc: 'Sở hữu (Wessen?)', color: '#A855F7' },
]

const ARTICLE_TABLE = {
  nominativ: { der: 'der', die: 'die', das: 'das', plural: 'die' },
  akkusativ: { der: 'den', die: 'die', das: 'das', plural: 'die' },
  dativ: { der: 'dem', die: 'der', das: 'dem', plural: 'den' },
  genitiv: { der: 'des', die: 'der', das: 'des', plural: 'der' },
}

export default function GrammarScreen() {
  const [expandedCase, setExpandedCase] = useState<string | null>('nominativ')

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['grammar-topics'],
    queryFn: () => api.get<GrammarTopic[]>('/grammar/topics').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Ngữ pháp tiếng Đức</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Cases reference */}
        <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider px-5 mb-3">
          Bảng cách (Kasus)
        </Text>

        {CASES.map((c) => {
          const isOpen = expandedCase === c.key
          const row = ARTICLE_TABLE[c.key as keyof typeof ARTICLE_TABLE]
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => setExpandedCase(isOpen ? null : c.key)}
              activeOpacity={0.8}
              className="mx-5 mb-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden"
            >
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-xl items-center justify-center"
                    style={{ backgroundColor: `${c.color}22` }}
                  >
                    <Text className="text-xs font-bold" style={{ color: c.color }}>
                      {c.key.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-white font-semibold text-sm">{c.label}</Text>
                    <Text className="text-[#64748B] text-xs">{c.desc}</Text>
                  </View>
                </View>
                {isOpen ? <ChevronUp size={18} color={Colors.muted} /> : <ChevronDown size={18} color={Colors.muted} />}
              </View>

              {isOpen && (
                <View className="px-4 pb-4">
                  <View className="bg-[#0D0D0D] rounded-xl overflow-hidden">
                    {/* Table header */}
                    <View className="flex-row border-b border-[#2A2A2A]">
                      {['', 'mask. (der)', 'fem. (die)', 'neut. (das)', 'Plural'].map((h, i) => (
                        <View key={i} className="flex-1 p-2">
                          <Text className="text-[#64748B] text-[10px] text-center font-medium">{h}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Definite row */}
                    <View className="flex-row">
                      <View className="flex-1 p-2">
                        <Text className="text-[#64748B] text-[10px] text-center">best.</Text>
                      </View>
                      {[row.der, row.die, row.das, row.plural].map((v, i) => (
                        <View key={i} className="flex-1 p-2">
                          <Text className="text-white text-xs text-center font-medium" style={{ color: c.color }}>{v}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        {/* Grammar topics from backend */}
        {topics.length > 0 && (
          <>
            <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider px-5 mt-5 mb-3">
              Bài học ngữ pháp
            </Text>
            {isLoading ? (
              <ActivityIndicator color={Colors.yellow} className="mt-4" />
            ) : (
              topics.map((topic) => (
                <View
                  key={topic.id}
                  className="mx-5 mb-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-white font-semibold text-sm flex-1 mr-2">{topic.title}</Text>
                    <View className="flex-row items-center gap-2">
                      <View className="bg-[#2A2A2A] rounded px-2 py-0.5">
                        <Text className="text-[#64748B] text-[10px]">{topic.cefrLevel}</Text>
                      </View>
                      {topic.isCompleted && (
                        <View className="w-5 h-5 rounded-full bg-[#2DC653]/20 items-center justify-center">
                          <Text className="text-[#2DC653] text-[10px]">✓</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text className="text-[#64748B] text-xs leading-4">{topic.summary}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
