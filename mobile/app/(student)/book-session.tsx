import { useState } from 'react'
import { View, ScrollView, Pressable, Alert } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Calendar, Clock, User, ChevronRight, Star } from 'lucide-react-native'
import { usePlanStore } from '@/stores/usePlanStore'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, Button, SectionHeader, Skeleton } from '@/components/ui'

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
  const theme = useTheme()
  const c = theme.colors
  const { isPro } = usePlanStore()
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get<Teacher[]>('/marketplace/teachers').then((r) => r.data),
    enabled: isPro,
  })

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['teacher-slots', selectedTeacher?.id],
    queryFn: () => api.get<TimeSlot[]>(`/marketplace/teachers/${selectedTeacher!.id}/slots`).then((r) => r.data),
    enabled: !!selectedTeacher,
  })

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post('/marketplace/sessions', {
        teacherId: selectedTeacher!.id,
        slotId: selectedSlot!.id,
      }),
    onSuccess: () => {
      Alert.alert('Đặt lịch thành công', 'Bạn sẽ nhận email xác nhận. Giáo viên sẽ liên hệ trước buổi học.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    },
    onError: () => {
      Alert.alert('Lỗi', 'Không thể đặt lịch. Vui lòng thử lại.')
    },
  })

  if (!isPro) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Đặt lịch học 1:1" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Star}
            title="Tính năng PRO"
            message="Nâng cấp lên DeutschFlow PRO để đặt lịch học 1:1 với giáo viên bản ngữ."
            actionLabel="Nâng cấp PRO"
            onAction={() => router.push('/(student)/upgrade')}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={selectedTeacher ? 'Chọn khung giờ' : 'Chọn giáo viên'}
        onBack={() => {
          if (selectedTeacher) {
            setSelectedTeacher(null)
            setSelectedSlot(null)
          } else {
            router.back()
          }
        }}
      />

      {!selectedTeacher ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space[8] }} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
              <Skeleton height={120} radius="2xl" />
              <Skeleton height={120} radius="2xl" />
            </View>
          ) : teachers.length === 0 ? (
            <EmptyState icon={User} title="Chưa có giáo viên" message="Hiện chưa có giáo viên. Vui lòng thử lại sau." />
          ) : (
            teachers.map((teacher) => (
              <Card key={teacher.id} onPress={() => setSelectedTeacher(teacher)} style={{ marginHorizontal: space[5], marginBottom: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                  <Avatar initial={teacher.avatarInitial} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ThemedText variant="bodyStrong">{teacher.displayName}</ThemedText>
                      <Icon icon={ChevronRight} size={18} color="faint" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon icon={Star} size={12} color="accent" fill />
                      <ThemedText variant="caption" color="accent">
                        {teacher.rating.toFixed(1)}
                      </ThemedText>
                      <ThemedText variant="caption" color="muted">
                        · {teacher.totalSessions} buổi
                      </ThemedText>
                    </View>
                    <ThemedText variant="caption" color="muted" numberOfLines={2}>
                      {teacher.bio}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[1] }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
                        {teacher.specialties.slice(0, 2).map((s) => (
                          <Pill key={s} label={s} tone="neutral" />
                        ))}
                      </View>
                      <ThemedText variant="bodyStrong">{teacher.pricePerHour.toLocaleString('vi-VN')}₫/giờ</ThemedText>
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <Card style={{ marginHorizontal: space[5], marginBottom: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Avatar initial={selectedTeacher.avatarInitial} size={40} />
              <View style={{ gap: 2 }}>
                <ThemedText variant="bodyStrong">{selectedTeacher.displayName}</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {selectedTeacher.pricePerHour.toLocaleString('vi-VN')}₫/giờ
                </ThemedText>
              </View>
            </View>
          </Card>

          <View style={{ paddingHorizontal: space[5] }}>
            <SectionHeader title="Khung giờ trống" />
          </View>

          {slotsLoading ? (
            <View style={{ paddingHorizontal: space[5], gap: space[2] }}>
              <Skeleton height={64} radius="2xl" />
              <Skeleton height={64} radius="2xl" />
            </View>
          ) : slots.length === 0 ? (
            <EmptyState icon={Calendar} title="Không có khung giờ" message="Không có khung giờ trống. Vui lòng thử giáo viên khác." />
          ) : (
            <View style={{ paddingHorizontal: space[5], flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
              {slots.map((slot) => {
                const start = new Date(slot.startTime)
                const end = new Date(slot.endTime)
                const isSelected = selectedSlot?.id === slot.id
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => slot.available && setSelectedSlot(isSelected ? null : slot)}
                    disabled={!slot.available}
                    style={{
                      width: '45%',
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? c.accent : c.border,
                      borderRadius: radius['2xl'],
                      padding: space[3],
                      alignItems: 'center',
                      gap: space[1],
                      opacity: slot.available ? 1 : 0.4,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon icon={Calendar} size={12} color={isSelected ? 'accent' : 'muted'} />
                      <ThemedText variant="caption" color={isSelected ? 'accent' : 'muted'}>
                        {start.toLocaleDateString('vi-VN', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon icon={Clock} size={12} color={isSelected ? 'accent' : 'muted'} />
                      <ThemedText variant="caption" color={isSelected ? 'primary' : 'muted'}>
                        {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )}
        </ScrollView>
      )}

      {selectedTeacher && selectedSlot ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: space[5],
            paddingBottom: space[8],
            paddingTop: space[4],
            backgroundColor: c.bg,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <Button
            label="Xác nhận đặt lịch"
            size="lg"
            loading={bookMutation.isPending}
            onPress={() => {
              Alert.alert(
                'Xác nhận đặt lịch',
                `Đặt buổi học với ${selectedTeacher.displayName}?\nGiá: ${selectedTeacher.pricePerHour.toLocaleString('vi-VN')}₫\n\nThanh toán qua website.`,
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Xác nhận', onPress: () => bookMutation.mutate() },
                ],
              )
            }}
          />
        </View>
      ) : null}
    </Screen>
  )
}

function Avatar({ initial, size }: { initial: string; size: number }) {
  const theme = useTheme()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.lg,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText variant="bodyStrong" color="onAccent">
        {initial}
      </ThemedText>
    </View>
  )
}
