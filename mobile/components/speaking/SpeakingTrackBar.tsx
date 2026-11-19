// Đầu tab Luyện nói (giao diện v3.4, Đợt 5): thanh chuyển "Phỏng vấn | Nói tự do" và ảnh đại diện.
// Owner chốt 18/11/2026: tab Luyện nói gồm Phỏng vấn theo nghề và Luyện nói tự do với AI.
// Thanh chuyển là neo của tour `speaking_intro` (thay hàng 4 ô chế độ cũ).

import { Pressable, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { radius, space, useTheme } from '@/lib/theme'
import { AvatarButton, ThemedText } from '@/components/ui'
import { SpotlightTarget } from '@/components/guide/SpotlightTour'
import { SPOTLIGHT_TARGETS } from '@/components/guide/spotlightTours'

export type SpeakingTrack = 'interview' | 'free'

const TRACKS: { key: SpeakingTrack; label: string }[] = [
  { key: 'interview', label: 'Phỏng vấn' },
  { key: 'free', label: 'Nói tự do' },
]

export function SpeakingTrackBar({ track, onChange }: { track: SpeakingTrack; onChange: (next: SpeakingTrack) => void }) {
  const c = useTheme().colors
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], paddingTop: space[3] }}>
      <SpotlightTarget id={SPOTLIGHT_TARGETS.speakingModeTabs}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 3,
          borderRadius: radius.full,
          backgroundColor: c.surfaceSunken,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        {TRACKS.map((t) => {
          const on = t.key === track
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return
                void Haptics.selectionAsync()
                onChange(t.key)
              }}
              style={{
                height: 32,
                paddingHorizontal: space[3],
                borderRadius: radius.full,
                justifyContent: 'center',
                backgroundColor: on ? c.surface : 'transparent',
                shadowColor: '#000',
                shadowOpacity: on ? 0.08 : 0,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
              }}
            >
              <ThemedText variant="label" style={{ color: on ? c.textPrimary : c.textMuted }}>
                {t.label}
              </ThemedText>
            </Pressable>
          )
        })}
      </View>
      </SpotlightTarget>
      <View style={{ flex: 1 }} />
      {/* Lối vào Tôi và cài đặt (Hồ sơ thôi là tab, owner chốt 18/11/2026). */}
      <AvatarButton />
    </View>
  )
}
