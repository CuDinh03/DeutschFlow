import { useState } from 'react'
import { View, Pressable, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Film } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, AppHeader, ThemedText, EmptyState, ErrorState } from '@/components/ui'
import { videoLessonApi } from '@/lib/videoLessonApi'
import { VideoLessonPlayer } from '@/components/video/VideoLessonPlayer'

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

export default function VideoLessonScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ level?: string }>()
  const initialLevel = LEVELS.find((l) => l === params.level) ?? 'A1'
  const [level, setLevel] = useState<string>(initialLevel)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['video-lesson', 'vocab', level],
    queryFn: () => videoLessonApi.getVocabTimeline(level),
    staleTime: 5 * 60_000,
  })

  return (
    <Screen edges={['top']}>
      <AppHeader title="Video ôn tập" onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[5], marginBottom: space[4] }}>
        {LEVELS.map((lv) => {
          const active = lv === level
          return (
            <Pressable
              key={lv}
              onPress={() => setLevel(lv)}
              style={{
                paddingHorizontal: space[4],
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: active ? c.accent : c.surfaceSunken,
                borderWidth: active ? 0 : 1,
                borderColor: c.border,
              }}
            >
              <ThemedText variant="label" color={active ? 'onAccent' : 'muted'}>
                {lv}
              </ThemedText>
            </Pressable>
          )
        })}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.scenes.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Chưa có video"
          message={`Cấp ${level} chưa có từ kèm hình ảnh. Thêm ảnh cho từ vựng rồi thử lại.`}
        />
      ) : (
        <VideoLessonPlayer timeline={data} />
      )}
    </Screen>
  )
}
