import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Star, Zap, Mic, Trophy, BookOpen, Check } from 'lucide-react-native'
import { Colors } from '@/lib/constants'

const PRO_FEATURES = [
  { icon: <Mic size={16} color={Colors.yellow} />, label: 'AI Speaking không giới hạn' },
  { icon: <Trophy size={16} color={Colors.yellow} />, label: 'Mock Exam Goethe chuẩn' },
  { icon: <Zap size={16} color={Colors.yellow} />, label: 'Weekly Speaking Challenge' },
  { icon: <BookOpen size={16} color={Colors.yellow} />, label: 'Toàn bộ lộ trình A1–B2' },
  { icon: <Star size={16} color={Colors.yellow} />, label: 'Phân tích lỗi chi tiết' },
]

export default function UpgradeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">DeutschFlow PRO</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View className="items-center py-8">
          <View className="w-20 h-20 rounded-3xl bg-[rgba(245,200,66,0.15)] items-center justify-center mb-4">
            <Star size={40} color={Colors.yellow} fill={Colors.yellow} />
          </View>
          <Text className="text-white text-2xl font-bold text-center">Mở khoá toàn bộ</Text>
          <Text className="text-[#64748B] text-sm text-center mt-2">
            Học tiếng Đức không giới hạn với AI coach và lộ trình cá nhân hoá
          </Text>
        </View>

        {/* Features */}
        <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 mb-6 gap-4">
          {PRO_FEATURES.map((f, i) => (
            <View key={i} className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-xl bg-[rgba(245,200,66,0.12)] items-center justify-center">
                {f.icon}
              </View>
              <Text className="text-white text-sm flex-1">{f.label}</Text>
              <Check size={16} color="#2DC653" />
            </View>
          ))}
        </View>

        {/* CTA — opens web for payment (no Apple IAP yet) */}
        <TouchableOpacity
          onPress={() => Linking.openURL('https://mydeutschflow.com/student/pricing')}
          className="bg-[#F5C842] rounded-2xl py-5 items-center mb-3"
          activeOpacity={0.85}
        >
          <Text className="text-[#0D0D0D] font-bold text-base">Nâng cấp tại mydeutschflow.com</Text>
          <Text className="text-[#0D0D0D]/60 text-xs mt-1">Mở trình duyệt web để hoàn tất</Text>
        </TouchableOpacity>

        <Text className="text-[#2A2A2A] text-xs text-center">
          Thanh toán qua website. Tài khoản PRO tự động cập nhật khi đăng nhập lại.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
