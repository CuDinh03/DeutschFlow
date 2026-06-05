import { useEffect, useRef, useState } from 'react'
import { View, Pressable } from 'react-native'
import { Audio } from 'expo-av'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from 'react-native-reanimated'
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Icon } from '@/components/ui'
import type { VideoTimeline } from '@/lib/videoLessonApi'

const FADE_MS = 350
const MIN_SCENE_MS = 2500

/**
 * Plays a learning-video timeline: each scene shows an image (crossfade + Ken Burns)
 * while its German narration plays, then auto-advances. When a scene has no narration
 * audio it is paced by `durationMs` instead. Audio streams straight from the scene's
 * S3 URL via expo-av (same approach as the AI-speaking screen).
 */
export function VideoLessonPlayer({ timeline }: { timeline: VideoTimeline }) {
  const c = useTheme().colors
  const scenes = timeline.scenes
  const lastIndex = scenes.length - 1

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  const soundRef = useRef<Audio.Sound | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const stopSound = async () => {
      const s = soundRef.current
      soundRef.current = null
      if (!s) return
      try {
        await s.stopAsync()
      } catch {
        /* already stopped */
      }
      try {
        await s.unloadAsync()
      } catch {
        /* already unloaded */
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
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
          const { sound } = await Audio.Sound.createAsync({ uri: scene.narrationAudioUrl }, { shouldPlay: true })
          if (cancelled) {
            await sound.unloadAsync()
            return
          }
          soundRef.current = sound
          sound.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded && st.didJustFinish) advance()
          })
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
    <View style={{ flex: 1 }}>
      <View
        style={{
          marginHorizontal: space[5],
          borderRadius: radius.xl,
          overflow: 'hidden',
          aspectRatio: 4 / 3,
          backgroundColor: c.surfaceSunken,
        }}
      >
        <Animated.Image
          source={{ uri: scene.imageUrl }}
          resizeMode="cover"
          style={[{ width: '100%', height: '100%' }, imageStyle]}
        />
      </View>

      {/* Scene progress dots */}
      <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', marginTop: space[3] }}>
        {scenes.map((s, i) => (
          <View
            key={s.seq}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: radius.full,
              backgroundColor: i === index ? c.accent : c.border,
            }}
          />
        ))}
      </View>

      {/* Captions */}
      <View style={{ paddingHorizontal: space[5], marginTop: space[4], gap: space[2], flex: 1 }}>
        <ThemedText variant="titleLg">{scene.captionDe}</ThemedText>
        <ThemedText variant="body" color="muted">
          {scene.captionVi}
        </ThemedText>
      </View>

      {/* Controls */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[6],
          paddingVertical: space[5],
        }}
      >
        <Pressable hitSlop={10} disabled={atStart} onPress={() => setIndex(index - 1)} style={{ opacity: atStart ? 0.3 : 1 }}>
          <Icon icon={ChevronLeft} size={28} color="muted" />
        </Pressable>

        <Pressable
          hitSlop={10}
          onPress={onTogglePlay}
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={playing ? Pause : Play} size={28} color="onAccent" />
        </Pressable>

        <Pressable hitSlop={10} disabled={atEnd} onPress={() => setIndex(index + 1)} style={{ opacity: atEnd ? 0.3 : 1 }}>
          <Icon icon={ChevronRight} size={28} color="muted" />
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', paddingBottom: space[4] }}>
        <ThemedText variant="caption" color="faint">
          {index + 1} / {scenes.length}
        </ThemedText>
      </View>
    </View>
  )
}
