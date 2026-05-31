import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { BookOpen, Map, FlaskConical, Trophy, ChevronRight } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface SkillTreeNode {
  id: number
  title: string
  cefrLevel: string
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED'
  dayNumber: number
}

export default function LearnScreen() {
  const { data: nodes = [] } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => api.get<SkillTreeNode[]>('/skill-tree/me').then(r => r.data),
    staleTime: 120_000,
  })

  const inProgress = nodes.filter(n => n.status === 'IN_PROGRESS').slice(0, 3)
  const available = nodes.filter(n => n.status === 'AVAILABLE').slice(0, 5)

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-5 pt-4 pb-2">
          <Text className="text-white text-2xl font-bold">Học tập</Text>
          <Text className="text-[#64748B] text-sm mt-0.5">Tiếp tục lộ trình của bạn</Text>
        </View>

        {/* Navigation tiles */}
        <View className="flex-row flex-wrap gap-3 px-5 mt-4">
          <LearningTile
            icon={<BookOpen size={22} color={Colors.yellow} />}
            label="SRS Flashcards"
            count={`${nodes.filter(n => n.status === 'COMPLETED').length} đã học`}
            color="#F5C842"
            onPress={() => router.push('/(student)/srs')}
          />
          <LearningTile
            icon={<Map size={22} color="#3A86FF" />}
            label="Lộ trình"
            count={`Ngày ${inProgress[0]?.dayNumber ?? 1}`}
            color="#3A86FF"
            onPress={() => router.push('/(student)/roadmap')}
          />
          <LearningTile
            icon={<FlaskConical size={22} color="#2DC653" />}
            label="Từ vựng"
            count="Tìm & luyện"
            color="#2DC653"
            onPress={() => router.push('/(student)/vocabulary')}
          />
          <LearningTile
            icon={<Trophy size={22} color="#A855F7" />}
            label="Thi thử"
            count="Mock Exam"
            color="#A855F7"
            onPress={() => router.push('/(student)/exam')}
          />
        </View>

        {/* Continue learning */}
        {inProgress.length > 0 && (
          <>
            <SectionHeader title="Đang học" onSeeAll={() => router.push('/(student)/roadmap')} />
            <View className="px-5 gap-2">
              {inProgress.map(node => (
                <NodeCard key={node.id} node={node} />
              ))}
            </View>
          </>
        )}

        {/* Next up */}
        {available.length > 0 && (
          <>
            <SectionHeader title="Tiếp theo" onSeeAll={() => router.push('/(student)/roadmap')} />
            <View className="px-5 gap-2">
              {available.map(node => (
                <NodeCard key={node.id} node={node} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function LearningTile({ icon, label, count, color, onPress }: {
  icon: React.ReactNode; label: string; count: string; color: string; onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 items-center justify-center"
      style={{ width: '47%' }}
      activeOpacity={0.75}
    >
      <View className="w-11 h-11 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: `${color}1A` }}>
        {icon}
      </View>
      <Text className="text-white text-sm font-semibold">{label}</Text>
      <Text className="text-[#64748B] text-xs mt-0.5">{count}</Text>
    </TouchableOpacity>
  )
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View className="flex-row justify-between items-center px-5 mt-5 mb-2">
      <Text className="text-white font-semibold text-base">{title}</Text>
      <TouchableOpacity onPress={onSeeAll} className="flex-row items-center gap-0.5">
        <Text className="text-[#64748B] text-sm">Xem tất cả</Text>
        <ChevronRight size={14} color={Colors.muted} />
      </TouchableOpacity>
    </View>
  )
}

function NodeCard({ node }: { node: SkillTreeNode }) {
  const statusColor = node.status === 'COMPLETED' ? '#2DC653' : node.status === 'IN_PROGRESS' ? '#F5C842' : '#3A86FF'
  const statusLabel = node.status === 'COMPLETED' ? 'Hoàn thành' : node.status === 'IN_PROGRESS' ? 'Đang học' : 'Bắt đầu'

  return (
    <TouchableOpacity
      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 flex-row items-center justify-between"
      activeOpacity={0.75}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${statusColor}1A` }}
        >
          <Text className="text-sm font-bold" style={{ color: statusColor }}>D{node.dayNumber}</Text>
        </View>
        <View>
          <Text className="text-white text-sm font-medium">{node.title}</Text>
          <Text className="text-[#64748B] text-xs">{node.cefrLevel}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Text className="text-xs font-medium" style={{ color: statusColor }}>{statusLabel}</Text>
        <ChevronRight size={14} color={Colors.muted} />
      </View>
    </TouchableOpacity>
  )
}
