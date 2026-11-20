import { useEffect, useRef, useState } from 'react'
import { View, Pressable } from 'react-native'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from 'react-native-reanimated'
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Icon, IconButton, ProgressBar } from '@/components/ui'
import { Chip, Rail, SectionHead } from '@/components/learn/HocOnParts'
import { useBlurGuard } from '@/hooks/useBlurGuard'
import type { VideoTimeline } from '@/lib/videoLessonApi'

const FADE_MS = 350
const MIN_SCENE_MS = 2500

/**
 * Plays a learning-video timeline: each scene shows an image (crossfade + Ken Burns)
 * while its German narration plays, then auto-advances. When a scene has no narration
 * audio it is paced by `durationMs` instead. Audio streams straight from the scene's
 * S3 URL via expo-audio (same approach as the AI-speaking screen).
 *
 * Giao diện v3.4 (Đợt 6A, mẫu `video`): khung mực bo lớn, nút phát tròn vàng ở góc khung, thanh tiến
 * độ theo cảnh, hàng chip các từ trong video (chạm để nhảy tới cảnh). Logic phát/tự chuyển cảnh giữ nguyên.
 */
export function VideoLessonPlayer({ timeline }: { timeline: VideoTimeline }) {
  const c = useTheme().colors
  const scenes = timeline.scenes
  const lastIndex = scenes.length - 1

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  const soundRef = useRef<AudioPlayer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Màn video-lesson nằm trong Tabs — chuyển tab không unmount, thuyết minh cứ
  // đọc tiếp và cảnh cứ tự trôi. Blur = pause (effect cảnh dọn player + timer);
  // quay lại người dùng tự bấm Play, đúng ngữ nghĩa trình phát video.
  useBlurGuard(() => setPlaying(false))

  const opacity = useSharedValue(0)
  const scale = useSharedValue(1)
  const imageStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  const scene = scenes[index]

  // Drive playback for the current scene; cleanup runs on scene change / pause / unmount.
  useEffect(() => {
    if (!scene || !playing) return
    let cancelled = false

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    const stopSound = () => {
      const s = soundRef.current
      soundRef.current = null
      if (!s) return
      try {
        s.remove()
      } catch {
        /* already released */
      }
    }
    const advance = () => {
      if (cancelled) return
      if (index < lastIndex) setIndex(index + 1)
      else setPlaying(false)
    }

    const durationMs = Math.max(MIN_SCENE_MS, scene.durationMs)

    // Crossfade in + slow Ken Burns zoom across the scene's duration.
    cancelAnimation(opacity)
    cancelAnimation(scale)
    opacity.value = 0
    scale.value = 1
    opacity.value = withTiming(1, { duration: FADE_MS })
    scale.value = withTiming(1.08, { duration: durationMs })

    void (async () => {
      await stopSound()
      if (cancelled) return
      if (scene.narrationAudioUrl) {
        try {
          await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
          const player = createAudioPlayer({ uri: scene.narrationAudioUrl })
          if (cancelled) {
            player.remove()
            return
          }
          soundRef.current = player
          player.addListener('playbackStatusUpdate', (st) => {
            if (st.didJustFinish) advance()
          })
          player.play()
          return
        } catch {
          /* narration unavailable — pace by duration instead */
        }
      }
      if (!cancelled) timerRef.current = setTimeout(advance, durationMs)
    })()

    return () => {
      cancelled = true
      clearTimer()
      void stopSound()
    }
  }, [index, playing, scene, lastIndex, opacity, scale])

  if (!scene) return null

  const atStart = index === 0
  const atEnd = index === lastIndex

  const onTogglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (atEnd) setIndex(0) // replay from the start
    setPlaying(true)
  }

  return (
    <View>
      <View
        style={{
          borderRadius: radius.lg,
          overflow: 'hidden',
          aspectRatio: 4 / 3,
          backgroundColor: c.inkSurface,
        }}
      >
        {scene.imageUrl ? (
          <Animated.Image
            source={{ uri: scene.imageUrl }}
            resizeMode="cover"
            accessibilityLabel={`${scene.germanWord}: ${scene.translation}`}
            style={[{ width: '100%', height: '100%' }, imageStyle]}
          />
        ) : (
          <Animated.View
            style={[
              {
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                padding: space[5],
              },
              imageStyle,
            ]}
          >
            <ThemedText variant="displayLg" color="onInk" align="center" accessibilityLanguage="de-DE">
              {scene.germanWord}
            </ThemedText>
            {scene.translation ? (
              <ThemedText variant="body" align="center" style={{ color: c.onInkMuted, marginTop: space[1] }}>
                {scene.translation}
              </ThemedText>
            ) : null}
          </Animated.View>
        )}

        {/* Mẫu `.vplay`: nút phát tròn vàng ở góc dưới phải khung. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Tạm dừng' : 'Phát'}
          onPress={onTogglePlay}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 14,
            bottom: 14,
            width: 52,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <Icon icon={playing ? Pause : Play} size={24} color="onAccent" />
        </Pressable>
      </View>

      {/* Tiến độ theo cảnh + chuyển cảnh trước/sau. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3] }}>
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="Câu trước"
          disabled={atStart}
          color="secondary"
          onPress={() => setIndex(index - 1)}
        />
        <View style={{ flex: 1 }}>
          <ProgressBar value={(index + 1) / scenes.length} height={6} />
        </View>
        <ThemedText variant="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {index + 1} / {scenes.length}
        </ThemedText>
        <IconButton
          icon={ChevronRight}
          accessibilityLabel="Câu sau"
          disabled={atEnd}
          color="secondary"
          onPress={() => setIndex(index + 1)}
        />
      </View>

      {/* Phụ đề */}
      <View style={{ marginTop: space[4], gap: space[1] }}>
        <ThemedText variant="titleLg" accessibilityLanguage="de-DE">
          {scene.captionDe}
        </ThemedText>
        <ThemedText variant="body" color="muted">
          {scene.captionVi}
        </ThemedText>
      </View>

      {scenes.length > 1 ? (
        <>
          <SectionHead title="Trong video này" right={`${scenes.length} cảnh`} />
          <Rail>
            {scenes.map((s, i) => (
              <Chip
                key={s.seq}
                label={s.germanWord || s.captionDe}
                on={i === index}
                accessibilityLabel={`Tới cảnh ${i + 1}: ${s.germanWord || s.captionDe}`}
                onPress={() => setIndex(i)}
              />
            ))}
          </Rail>
        </>
      ) : null}
    </View>
  )
}
