import { useEffect, useRef, useState } from 'react'
import { View, ActivityIndicator, Alert, Share } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { space, useTheme } from '@/lib/theme'
import { Screen, Button, EmptyState, ErrorState } from '@/components/ui'
import { Chip, Rail, SectionHead, TopBar } from '@/components/learn/HocOnParts'
import { apiMessage } from '@/lib/api'
import { videoLessonApi } from '@/lib/videoLessonApi'
import { VideoLessonPlayer } from '@/components/video/VideoLessonPlayer'
import { useBackTo } from '@/hooks/useBackTo'

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

const LISTEN_TOPICS = [
  { de: 'Im Café', vi: 'Ở quán cà phê' },
  { de: 'Einkaufen', vi: 'Mua sắm' },
  { de: 'Wegbeschreibung', vi: 'Hỏi đường' },
  { de: 'Beim Arzt', vi: 'Ở bác sĩ' },
  { de: 'Im Restaurant', vi: 'Ở nhà hàng' },
] as const

// Giao diện v3.4 (Đợt 6A, mẫu `video`): đầu màn có tên ở giữa, chip chọn cấp / Tới hạn / Hội thoại cuộn
// ngang, chủ đề hội thoại thành chip, nút "Xuất video mp4" toàn chiều ngang cuối màn. Truy vấn, chế độ,
// xuất mp4 (poll + Share) giữ nguyên.
export default function VideoLessonScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ level?: string; type?: string; caseName?: string; title?: string; from?: string }>()
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(() => (params.from === 'vocabulary' ? '/(student)/vocabulary' : '/(student)/grammar'))
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
      <TopBar onBack={goBack} title={isGrammar ? (params.title ?? 'Video ngữ pháp') : 'Video ôn tập'} />

      <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], paddingTop: space[3] }}>
        {!isGrammar && (
          <Rail style={{ marginBottom: space[4] }}>
            {LEVELS.map((lv) => (
              <Chip
                key={lv}
                label={lv}
                accessibilityLabel={`Cấp ${lv}`}
                on={!due && !listening && lv === level}
                onPress={() => {
                  setLevel(lv)
                  setDue(false)
                  setListening(false)
                }}
              />
            ))}
            <Chip
              label="Tới hạn"
              on={due && !listening}
              onPress={() => {
                setDue(true)
                setListening(false)
              }}
            />
            <Chip
              label="Hội thoại"
              on={listening}
              onPress={() => {
                setListening(true)
                setDue(false)
              }}
            />
          </Rail>
        )}

        {!isGrammar && listening && (
          <>
            <SectionHead title="Hội thoại" right={`Cấp ${level}`} style={{ marginTop: 0 }} />
            <Rail style={{ marginBottom: space[4] }}>
              {LISTEN_TOPICS.map((t) => (
                <Chip key={t.de} label={t.vi} on={topic === t.de} onPress={() => setTopic(t.de)} />
              ))}
            </Rail>
          </>
        )}

        {isLoading ? (
          <View style={{ paddingVertical: space[10], alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.textPrimary} />
          </View>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !data || data.scenes.length === 0 ? (
          <EmptyState
            glyph="video"
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

        {/* Phase B — xuất mp4 chỉ cho video từ vựng theo cấp (render ở server). */}
        {!isGrammar && mode === 'level' && !!data && data.scenes.length > 0 && (
          <Button
            label={exporting ? 'Đang xuất…' : 'Xuất video mp4'}
            variant="secondary"
            loading={exporting}
            disabled={exporting}
            onPress={() => void startExport()}
            style={{ marginTop: space[5] }}
          />
        )}
      </Screen>
    </Screen>
  )
}
