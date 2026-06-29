import { useEffect, useRef, useState } from 'react'
import { View, Pressable, ActivityIndicator, Alert, Share } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Film, Download } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, AppHeader, ThemedText, Icon, EmptyState, ErrorState } from '@/components/ui'
import { apiMessage } from '@/lib/api'
import { videoLessonApi } from '@/lib/videoLessonApi'
import { VideoLessonPlayer } from '@/components/video/VideoLessonPlayer'

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

const LISTEN_TOPICS = [
  { de: 'Im Café', vi: 'Ở quán cà phê' },
  { de: 'Einkaufen', vi: 'Mua sắm' },
  { de: 'Wegbeschreibung', vi: 'Hỏi đường' },
  { de: 'Beim Arzt', vi: 'Ở bác sĩ' },
  { de: 'Im Restaurant', vi: 'Ở nhà hàng' },
] as const

export default function VideoLessonScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ level?: string; type?: string; caseName?: string; title?: string }>()
  const isGrammar = !!params.caseName
  const initialLevel = LEVELS.find((l) => l === params.level) ?? 'A1'
  const [level, setLevel] = useState<string>(initialLevel)
  const [due, setDue] = useState(params.type === 'due')
  const [listening, setListening] = useState(params.type === 'listening')
  const [topic, setTopic] = useState<string>(LISTEN_TOPICS[0].de)
  const mode: 'grammar' | 'listening' | 'due' | 'level' = isGrammar
    ? 'grammar'
    : listening
      ? 'listening'
      : due
        ? 'due'
        : 'level'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['video-lesson', mode, isGrammar ? params.caseName : level, listening ? topic : ''],
    queryFn: () => {
      if (isGrammar) return videoLessonApi.getGrammarTimelineByName(params.caseName ?? '')
      if (listening) return videoLessonApi.getListeningTimeline(topic, level)
      if (due) return videoLessonApi.getDueTimeline()
      return videoLessonApi.getVocabTimeline(level)
    },
    staleTime: 5 * 60_000,
  })

  // Phase B — export the timeline to a shareable .mp4 (render runs on the server).
  const [exporting, setExporting] = useState(false)
  const cancelledRef = useRef(false)
  useEffect(() => () => { cancelledRef.current = true }, [])

  const pollRender = async (jobId: string) => {
    for (let i = 0; i < 60; i++) {
      if (cancelledRef.current) return
      await new Promise((resolve) => setTimeout(resolve, 3000))
      if (cancelledRef.current) return
      try {
        const st = await videoLessonApi.getRenderStatus(jobId)
        // The request may have been in flight when the screen was unmounted — don't
        // act on a stale result (would fire Share/Alert + setState after navigating away).
        if (cancelledRef.current) return
        if (st.status === 'COMPLETED' && st.videoUrl) {
          setExporting(false)
          await Share.share({ message: st.videoUrl, url: st.videoUrl })
          return
        }
        if (st.status === 'FAILED') {
          setExporting(false)
          Alert.alert('Xuất video thất bại', st.error ?? 'Vui lòng thử lại.')
          return
        }
      } catch {
        // transient network error — keep polling
      }
    }
    setExporting(false)
    Alert.alert('Hết thời gian', 'Render lâu hơn dự kiến, thử lại sau.')
  }

  const startExport = async () => {
    setExporting(true)
    try {
      const jobId = await videoLessonApi.startVocabRender(level)
      void pollRender(jobId)
    } catch (e) {
      setExporting(false)
      Alert.alert('Không xuất được', apiMessage(e))
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={isGrammar ? (params.title ?? 'Video ngữ pháp') : 'Video ôn tập'}
        onBack={() => router.back()}
      />

      {!isGrammar && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space[5],
            marginBottom: space[4],
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {LEVELS.map((lv) => {
              const active = !due && !listening && lv === level
              return (
                <Pressable
                  key={lv}
                  accessibilityRole="button"
                  accessibilityLabel={`Cấp ${lv}`}
                  accessibilityState={{ selected: active }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  onPress={() => {
                    setLevel(lv)
                    setDue(false)
                    setListening(false)
                  }}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tới hạn"
              accessibilityState={{ selected: due }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => {
                setDue(true)
                setListening(false)
              }}
              style={{
                paddingHorizontal: space[4],
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: due ? c.accent : c.surfaceSunken,
                borderWidth: due ? 0 : 1,
                borderColor: c.border,
              }}
            >
              <ThemedText variant="label" color={due ? 'onAccent' : 'muted'}>
                Tới hạn
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hội thoại"
              accessibilityState={{ selected: listening }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => {
                setListening(true)
                setDue(false)
              }}
              style={{
                paddingHorizontal: space[4],
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: listening ? c.accent : c.surfaceSunken,
                borderWidth: listening ? 0 : 1,
                borderColor: c.border,
              }}
            >
              <ThemedText variant="label" color={listening ? 'onAccent' : 'muted'}>
                Hội thoại
              </ThemedText>
            </Pressable>
          </View>

          {mode === 'level' && !!data && data.scenes.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xuất video mp4"
              accessibilityState={{ disabled: exporting }}
              onPress={() => void startExport()}
              disabled={exporting}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Icon icon={Download} size={18} color="accent" />
              )}
              <ThemedText variant="label" color="accent">
                {exporting ? 'Đang xuất…' : '.mp4'}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}

      {!isGrammar && listening && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space[2],
            paddingHorizontal: space[5],
            marginBottom: space[4],
          }}
        >
          {LISTEN_TOPICS.map((t) => {
            const active = topic === t.de
            return (
              <Pressable
                key={t.de}
                accessibilityRole="button"
                accessibilityLabel={t.vi}
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                onPress={() => setTopic(t.de)}
                style={{
                  paddingHorizontal: space[3],
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: active ? c.accentSoft : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? c.accent : c.border,
                }}
              >
                <ThemedText variant="caption" color={active ? 'accent' : 'muted'}>
                  {t.vi}
                </ThemedText>
              </Pressable>
            )
          })}
        </View>
      )}

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
          message={
            isGrammar
              ? 'Chủ đề ngữ pháp này chưa có nội dung video.'
              : listening
                ? 'Chưa tạo được hội thoại (cần dịch vụ AI). Thử lại sau.'
                : due
                  ? 'Không có từ tới hạn kèm hình ảnh. Học thêm hoặc thêm ảnh cho từ.'
                  : `Cấp ${level} chưa có từ kèm hình ảnh. Thêm ảnh cho từ vựng rồi thử lại.`
          }
        />
      ) : (
        <VideoLessonPlayer timeline={data} />
      )}
    </Screen>
  )
}
