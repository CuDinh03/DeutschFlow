import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Lock, CheckCircle2, Circle, PlayCircle } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface SkillNode {
  id: number
  title: string
  cefrLevel: string
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED'
  dayNumber: number
  tags?: string[]
}

export default function RoadmapScreen() {
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => api.get<SkillNode[]>('/skill-tree/me').then(r => r.data),
    staleTime: 120_000,
  })

  const grouped = nodes.reduce<Record<string, SkillNode[]>>((acc, node) => {
    const key = node.cefrLevel
    if (!acc[key]) acc[key] = []
    acc[key].push(node)
    return acc
  }, {})

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Lộ trình học</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 20 }}>
          {Object.entries(grouped).map(([level, levelNodes]) => (
            <View key={level} className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="h-px flex-1 bg-[#2A2A2A]" />
                <View className="bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1 rounded-full">
                  <Text className="text-[#64748B] text-xs font-bold">{level}</Text>
                </View>
                <View className="h-px flex-1 bg-[#2A2A2A]" />
              </View>
              <View className="gap-2">
                {levelNodes.map((node, i) => (
                  <NodeRow key={node.id} node={node} isLast={i === levelNodes.length - 1} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function NodeRow({ node, isLast }: { node: SkillNode; isLast: boolean }) {
  const isLocked = node.status === 'LOCKED'
  const isDone = node.status === 'COMPLETED'
  const isActive = node.status === 'IN_PROGRESS'

  return (
    <View className="flex-row">
      {/* Timeline line */}
      <View className="w-8 items-center">
        <View className="mt-4">
          {isDone ? (
            <CheckCircle2 size={22} color="#2DC653" fill="#2DC6531A" />
          ) : isActive ? (
            <PlayCircle size={22} color={Colors.yellow} />
          ) : isLocked ? (
            <Lock size={18} color="#2A2A2A" />
          ) : (
            <Circle size={22} color="#3A86FF" />
          )}
        </View>
        {!isLast && <View className="flex-1 w-px bg-[#2A2A2A] mt-1" />}
      </View>

      {/* Card */}
      <TouchableOpacity
        disabled={isLocked}
        className={`flex-1 ml-3 mb-2 rounded-xl p-4 border ${
          isLocked
            ? 'bg-[#111111] border-[#1A1A1A] opacity-50'
            : isActive
            ? 'bg-[#1A1A1A] border-[#F5C842]/40'
            : isDone
            ? 'bg-[#1A1A1A] border-[#2DC653]/30'
            : 'bg-[#1A1A1A] border-[#2A2A2A]'
        }`}
        activeOpacity={0.75}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className={`font-semibold text-sm ${isLocked ? 'text-[#2A2A2A]' : 'text-white'}`}>
              {node.title}
            </Text>
            <Text className="text-[#64748B] text-xs mt-0.5">Ngày {node.dayNumber}</Text>
          </View>
          {isActive && (
            <View className="bg-[rgba(245,200,66,0.15)] px-2 py-0.5 rounded-full">
              <Text className="text-[#F5C842] text-[10px] font-bold">ĐANG HỌC</Text>
            </View>
          )}
        </View>
        {node.tags && node.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mt-2">
            {node.tags.slice(0, 3).map(tag => (
              <View key={tag} className="bg-[#0D0D0D] px-2 py-0.5 rounded-full">
                <Text className="text-[#64748B] text-[10px]">{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}
