import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Calendar, Clock, User, ChevronRight, Star } from 'lucide-react-native'
import { usePlanStore } from '@/stores/usePlanStore'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface Teacher {
  id: string
  displayName: string
  bio: string
  specialties: string[]
  pricePerHour: number
  rating: number
  totalSessions: number
  avatarInitial: string
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  available: boolean
}

export default function BookSessionScreen() {
  const { isPro } = usePlanStore()
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get<Teacher[]>('/marketplace/teachers').then(r => r.data),
    enabled: isPro,
  })

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['teacher-slots', selectedTeacher?.id],
    queryFn: () => api.get<TimeSlot[]>(`/marketplace/teachers/${selectedTeacher!.id}/slots`).then(r => r.data),
    enabled: !!selectedTeacher,
  })

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post('/marketplace/sessions', {
        teacherId: selectedTeacher!.id,
        slotId: selectedSlot!.id,
      }),
    onSuccess: () => {
      Alert.alert(
        'Đặt lịch thành công! 🎉',
        'Bạn sẽ nhận email xác nhận. Giáo viên sẽ liên hệ trước buổi học.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    },
    onError: () => {
      Alert.alert('Lỗi', 'Không thể đặt lịch. Vui lòng thử lại.')
    },
  })

  // PRO gate
  if (!isPro) {
    return (
      <SafeAreaView className="flex-1 bg-[#0D0D0D]">
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.muted} />
          </TouchableOpacity>
          <Text className="text-white text-lg font-bold">Đặt lịch học 1:1</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-2xl bg-[#F5C842]/15 items-center justify-center mb-4">
            <Star size={32} color={Colors.yellow} fill={Colors.yellow} />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">Tính năng PRO</Text>
          <Text className="text-[#64748B] text-sm text-center mb-8 leading-5">
            Nâng cấp lên DeutschFlow PRO để đặt lịch học 1:1 với giáo viên bản ngữ.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(student)/upgrade')}
            className="bg-[#F5C842] rounded-2xl px-8 py-4 w-full items-center"
          >
            <Text className="text-[#0D0D0D] font-bold text-base">Nâng cấp PRO</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
        <TouchableOpacity
          onPress={() => {
            if (selectedTeacher) {
              setSelectedTeacher(null)
              setSelectedSlot(null)
            } else {
              router.back()
            }
          }}
        >
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">
          {selectedTeacher ? 'Chọn khung giờ' : 'Chọn giáo viên'}
        </Text>
      </View>

      {!selectedTeacher ? (
        // Teacher list
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
          {isLoading ? (
            <ActivityIndicator color={Colors.yellow} className="mt-8" />
          ) : teachers.length === 0 ? (
            <View className="items-center mt-12 px-8">
              <User size={40} color={Colors.muted} />
              <Text className="text-[#64748B] text-sm text-center mt-3">
                Hiện chưa có giáo viên. Vui lòng thử lại sau.
              </Text>
            </View>
          ) : (
            teachers.map((teacher) => (
              <TouchableOpacity
                key={teacher.id}
                onPress={() => setSelectedTeacher(teacher)}
                activeOpacity={0.8}
                className="mx-5 mb-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4"
              >
                <View className="flex-row items-start gap-3">
                  <View className="w-12 h-12 rounded-2xl bg-[#F5C842] items-center justify-center flex-shrink-0">
                    <Text className="text-[#0D0D0D] text-lg font-bold">{teacher.avatarInitial}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white font-semibold text-base">{teacher.displayName}</Text>
                      <ChevronRight size={18} color={Colors.muted} />
                    </View>
                    <View className="flex-row items-center gap-1 mb-1.5">
                      <Star size={12} color={Colors.yellow} fill={Colors.yellow} />
                      <Text className="text-[#F5C842] text-xs font-medium">{teacher.rating.toFixed(1)}</Text>
                      <Text className="text-[#64748B] text-xs">· {teacher.totalSessions} buổi</Text>
                    </View>
                    <Text className="text-[#64748B] text-xs leading-4 mb-2" numberOfLines={2}>
                      {teacher.bio}
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row flex-wrap gap-1">
                        {teacher.specialties.slice(0, 2).map((s) => (
                          <View key={s} className="bg-[#2A2A2A] rounded px-2 py-0.5">
                            <Text className="text-[#64748B] text-[10px]">{s}</Text>
                          </View>
                        ))}
                      </View>
                      <Text className="text-white text-xs font-semibold">
                        {teacher.pricePerHour.toLocaleString('vi-VN')}₫/giờ
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        // Slot picker
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Teacher summary */}
          <View className="mx-5 mb-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-[#F5C842] items-center justify-center">
              <Text className="text-[#0D0D0D] font-bold">{selectedTeacher.avatarInitial}</Text>
            </View>
            <View>
              <Text className="text-white font-semibold">{selectedTeacher.displayName}</Text>
              <Text className="text-[#64748B] text-xs">
                {selectedTeacher.pricePerHour.toLocaleString('vi-VN')}₫/giờ
              </Text>
            </View>
          </View>

          <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider px-5 mb-3">
            Khung giờ trống
          </Text>

          {slotsLoading ? (
            <ActivityIndicator color={Colors.yellow} className="mt-4" />
          ) : slots.length === 0 ? (
            <View className="items-center mt-6 px-8">
              <Calendar size={36} color={Colors.muted} />
              <Text className="text-[#64748B] text-sm text-center mt-3">
                Không có khung giờ trống. Vui lòng thử giáo viên khác.
              </Text>
            </View>
          ) : (
            <View className="px-5 flex-row flex-wrap gap-3">
              {slots.map((slot) => {
                const start = new Date(slot.startTime)
                const end = new Date(slot.endTime)
                const isSelected = selectedSlot?.id === slot.id
                return (
                  <TouchableOpacity
                    key={slot.id}
                    onPress={() => slot.available && setSelectedSlot(isSelected ? null : slot)}
                    disabled={!slot.available}
                    className={`bg-[#1A1A1A] border rounded-2xl p-3 w-[45%] items-center ${
                      isSelected
                        ? 'border-[#F5C842]'
                        : slot.available
                        ? 'border-[#2A2A2A]'
                        : 'border-[#2A2A2A] opacity-40'
                    }`}
                  >
                    <View className="flex-row items-center gap-1 mb-1">
                      <Calendar size={12} color={isSelected ? Colors.yellow : Colors.muted} />
                      <Text className={`text-xs font-medium ${isSelected ? 'text-[#F5C842]' : 'text-[#64748B]'}`}>
                        {start.toLocaleDateString('vi-VN', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Clock size={12} color={isSelected ? Colors.yellow : Colors.muted} />
                      <Text className={`text-xs ${isSelected ? 'text-white' : 'text-[#64748B]'}`}>
                        {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Confirm button */}
      {selectedTeacher && selectedSlot && (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-[#0D0D0D] border-t border-[#1A1A1A]">
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Xác nhận đặt lịch',
                `Đặt buổi học với ${selectedTeacher.displayName}?\nGiá: ${selectedTeacher.pricePerHour.toLocaleString('vi-VN')}₫\n\nThanh toán qua website.`,
                [
                  { text: 'Hủy', style: 'cancel' },
                  {
                    text: 'Xác nhận',
                    onPress: () => bookMutation.mutate(),
                  },
                ]
              )
            }}
            disabled={bookMutation.isPending}
            className="bg-[#F5C842] rounded-2xl py-4 items-center"
            activeOpacity={0.85}
          >
            {bookMutation.isPending ? (
              <ActivityIndicator color="#0D0D0D" />
            ) : (
              <Text className="text-[#0D0D0D] font-bold text-base">Xác nhận đặt lịch</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}
