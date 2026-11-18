// Nút ảnh đại diện ở góc trên các màn tab — lối vào "Tôi và cài đặt".
//
// Owner chốt 18/11/2026: thanh tab theo khu học viên trên web (Hôm nay · Học · Luyện nói ·
// Luyện thi · Tiến bộ); "Tôi" (màn profile) không còn là tab mà mở từ ảnh đại diện.
// Có ảnh tự tải lên thì hiện ảnh, không thì chữ cái cuối của tên (tên Việt: tên gọi đứng cuối).

import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTheme } from '@/lib/theme'
import { avatarInitial } from '@/lib/avatarInitial'
import { captureEvent } from '@/lib/analytics'
import { ThemedText } from './ThemedText'

const SIZE = 40

export function AvatarButton() {
  const c = useTheme().colors
  const user = useAuthStore((s) => s.user)
  const name = user?.displayName ?? ''
  const avatarUrl = user?.avatarUrl ?? null
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name ? `Tôi và cài đặt, ${name}` : 'Tôi và cài đặt'}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync()
        // Giữ chuỗi số liệu cũ của tab Hồ sơ: cùng sự kiện, khác nguồn.
        captureEvent('nav_clicked', { feature: 'profile', from: 'avatar' })
        router.push('/(student)/profile')
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: c.surface,
        }}
      >
        {avatarUrl && !imageFailed ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: SIZE, height: SIZE }}
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ThemedText variant="title" style={{ color: c.onAccent, fontSize: 17, lineHeight: 22 }}>
            {avatarInitial(name)}
          </ThemedText>
        )}
      </View>
    </Pressable>
  )
}
