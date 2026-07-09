import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { Mic, Camera, MessageSquareText, ExternalLink } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Button, Icon } from '@/components/ui'
import { registerAiConsentPresenter, setAiConsent } from '@/lib/aiConsent'
import { openPrivacyPolicy } from '@/lib/legal'
import { captureEvent } from '@/lib/analytics'

// AI data-sharing disclosure + consent sheet (App Store 5.1.1(i)/5.1.2(i)).
//
// Mounted ONCE in the root layout as <AiConsentHost/>. Feature code never renders this
// directly — it calls `ensureAiConsent()` (lib/aiConsent.ts), which asks this host to
// present itself and resolves with the user's decision.

interface DataRow {
  icon: typeof Mic
  title: string
  body: string
}

const DATA_ROWS: DataRow[] = [
  {
    icon: Mic,
    title: 'Bản ghi âm giọng nói',
    body: 'Khi bạn luyện nói hoặc nộp bài nói, bản ghi âm được gửi đi để nhận dạng giọng nói và chấm phát âm.',
  },
  {
    icon: Camera,
    title: 'Ảnh bài viết bạn tải lên',
    body: 'Khi bạn chụp/chọn ảnh bài viết tay để nộp, ảnh được gửi đi để đọc chữ và chấm bài.',
  },
  {
    icon: MessageSquareText,
    title: 'Nội dung hội thoại & bài làm',
    body: 'Tin nhắn luyện nói với AI và bài làm dạng văn bản được gửi đi để tạo phản hồi và sửa lỗi.',
  },
]

export function AiConsentHost() {
  const c = useTheme().colors
  const [visible, setVisible] = useState(false)
  const resolverRef = useRef<((granted: boolean) => void) | null>(null)

  const present = useCallback((): Promise<boolean> => {
    // If a request is already showing, chain onto the same decision.
    if (resolverRef.current) {
      return new Promise<boolean>((resolve) => {
        const prev = resolverRef.current
        resolverRef.current = (granted: boolean) => {
          prev?.(granted)
          resolve(granted)
        }
      })
    }
    captureEvent('ai_consent_shown')
    setVisible(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  useEffect(() => {
    registerAiConsentPresenter(present)
    return () => registerAiConsentPresenter(null)
  }, [present])

  async function decide(granted: boolean) {
    await setAiConsent(granted)
    captureEvent(granted ? 'ai_consent_granted' : 'ai_consent_denied')
    setVisible(false)
    resolverRef.current?.(granted)
    resolverRef.current = null
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void decide(false)}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space[6],
            paddingTop: space[6],
            paddingBottom: space[8],
            maxHeight: '88%',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <ThemedText variant="titleLg">Tính năng AI & dữ liệu của bạn</ThemedText>
            <ThemedText variant="body" color="secondary" style={{ marginTop: space[2] }}>
              Để luyện nói, chấm bài và phản hồi tự động, MyDeutschFlow gửi một phần dữ liệu của bạn
              tới các đối tác AI: <ThemedText variant="bodyStrong">Groq</ThemedText>,{' '}
              <ThemedText variant="bodyStrong">OpenAI</ThemedText> và{' '}
              <ThemedText variant="bodyStrong">Google (Gemini)</ThemedText>.
            </ThemedText>

            <View style={{ gap: space[4], marginTop: space[5] }}>
              {DATA_ROWS.map((row) => (
                <View key={row.title} style={{ flexDirection: 'row', gap: space[3] }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: c.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}
                  >
                    <Icon icon={row.icon} size={18} color="accent" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="bodyStrong">{row.title}</ThemedText>
                    <ThemedText variant="caption" color="secondary" style={{ lineHeight: 18 }}>
                      {row.body}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <ThemedText variant="caption" color="secondary" style={{ marginTop: space[5], lineHeight: 18 }}>
              Dữ liệu chỉ được dùng để xử lý yêu cầu học tập của bạn — không dùng cho quảng cáo. Bạn có
              thể đổi quyết định bất cứ lúc nào trong Hồ sơ → Quyền riêng tư. Nếu không đồng ý, bạn vẫn
              dùng được toàn bộ tính năng không có AI.
            </ThemedText>

            <Pressable
              accessibilityRole="link"
              onPress={openPrivacyPolicy}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[3] }}
            >
              <ThemedText variant="caption" color="accent">
                Xem Chính sách bảo mật
              </ThemedText>
              <Icon icon={ExternalLink} size={13} color="accent" />
            </Pressable>

            <View style={{ gap: space[3], marginTop: space[6] }}>
              <Button label="Đồng ý và tiếp tục" onPress={() => void decide(true)} />
              <Button label="Không đồng ý" variant="ghost" onPress={() => void decide(false)} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
