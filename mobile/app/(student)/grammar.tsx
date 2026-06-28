import { useState, useEffect, useRef } from 'react'
import { View, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { ChevronDown, ChevronUp, Check, Film, BookOpen } from 'lucide-react-native'
import api from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, SectionHeader, Caption, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { mapGrammarTopic, type RawGrammarTopic } from '@/lib/grammarApi'

const CASES = [
  { key: 'nominativ', label: 'Nominativ', desc: 'Chủ ngữ (Wer? Was?)' },
  { key: 'akkusativ', label: 'Akkusativ', desc: 'Tân ngữ trực tiếp (Wen? Was?)' },
  { key: 'dativ', label: 'Dativ', desc: 'Tân ngữ gián tiếp (Wem?)' },
  { key: 'genitiv', label: 'Genitiv', desc: 'Sở hữu (Wessen?)' },
] as const

const ARTICLE_TABLE = {
  nominativ: { der: 'der', die: 'die', das: 'das', plural: 'die' },
  akkusativ: { der: 'den', die: 'die', das: 'das', plural: 'die' },
  dativ: { der: 'dem', die: 'der', das: 'dem', plural: 'den' },
  genitiv: { der: 'des', die: 'der', das: 'des', plural: 'der' },
}

const TABLE_HEADERS = ['', 'mask. (der)', 'fem. (die)', 'neut. (das)', 'Plural']

// Per-column gender tint for the declension table (index-aligned with the
// header/form columns: 0=row label, 1=der, 2=die, 3=das, 4=plural).
type ThemeColors = ReturnType<typeof useTheme>['colors']
const GENDER_HEX: ((c: ThemeColors) => string)[] = [
  (c) => c.textMuted,
  (c) => c.der,
  (c) => c.die,
  (c) => c.das,
  (c) => c.textSecondary,
]

export default function GrammarScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [expandedCase, setExpandedCase] = useState<string | null>('nominativ')

  const startedRef = useRef(false)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      trackFeatureAction('grammar', 'started')
    }
  }, [])

  const { data: topics = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['grammar-topics'],
    queryFn: () =>
      api
        .get<RawGrammarTopic[]>('/grammar/syllabus/topics', { params: { cefrLevel: 'A1' } })
        .then((r) => r.data.map(mapGrammarTopic)),
    staleTime: 5 * 60_000,
  })

  return (
    <Screen edges={['top']}>
      <AppHeader title="Ngữ pháp tiếng Đức" onBack={() => router.back()} />

      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingBottom: space[8] }}
        refreshing={isFetching && !isLoading}
        onRefresh={() => void refetch()}
      >
        {/* Editorial ink hero — the Kasus system is the conceptual anchor of this screen */}
        <View style={{ paddingHorizontal: space[5], marginTop: space[1], marginBottom: space[5] }}>
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
            <Caption color={c.accent}>Grammatik · 4 Kasus</Caption>
            <ThemedText variant="display" style={{ color: c.onInk, marginTop: space[2] }}>
              Bảng cách tiếng Đức
            </ThemedText>
            <ThemedText variant="caption" style={{ color: c.onInkMuted, marginTop: space[2] }}>
              Mỗi danh từ đổi mạo từ theo cách. Chạm vào từng cách để xem bảng chia der / die / das.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[4] }}>
              <DeclLegend label="der" tone="der" />
              <DeclLegend label="die" tone="die" />
              <DeclLegend label="das" tone="das" />
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: space[5] }}>
          <Caption style={{ marginBottom: space[1] }}>Kasus</Caption>
          <SectionHeader title="Bảng cách" />
        </View>

        {CASES.map((kasus) => {
          const isOpen = expandedCase === kasus.key
          const row = ARTICLE_TABLE[kasus.key as keyof typeof ARTICLE_TABLE]
          return (
            <Card
              key={kasus.key}
              padded={false}
              onPress={() => setExpandedCase(isOpen ? null : kasus.key)}
              style={{ marginHorizontal: space[5], marginBottom: space[2], overflow: 'hidden' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[4] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.sm,
                      backgroundColor: isOpen ? c.accentSoft : c.surfaceSunken,
                      borderWidth: 1,
                      borderColor: isOpen ? c.accentSoft : c.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ThemedText variant="title" color={isOpen ? 'accent' : 'secondary'}>
                      {kasus.key.slice(0, 1).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={{ gap: 2 }}>
                    <ThemedText variant="bodyStrong">{kasus.label}</ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {kasus.desc}
                    </ThemedText>
                  </View>
                </View>
                <Icon icon={isOpen ? ChevronUp : ChevronDown} size={18} color="muted" />
              </View>

              {isOpen ? (
                <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
                  <View
                    style={{
                      backgroundColor: c.surfaceSunken,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: c.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.borderStrong }}>
                      {TABLE_HEADERS.map((h, i) => (
                        <View key={i} style={{ flex: 1, paddingVertical: space[2], paddingHorizontal: space[1] }}>
                          <ThemedText variant="caption" align="center" style={{ color: GENDER_HEX[i](c) }}>
                            {h}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, paddingVertical: space[3], paddingHorizontal: space[1] }}>
                        <ThemedText variant="caption" color="muted" align="center">
                          best.
                        </ThemedText>
                      </View>
                      {[row.der, row.die, row.das, row.plural].map((v, i) => (
                        <View key={i} style={{ flex: 1, paddingVertical: space[3], paddingHorizontal: space[1] }}>
                          <ThemedText
                            variant="title"
                            align="center"
                            style={{ color: GENDER_HEX[i](c) }}
                          >
                            {v}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(student)/video-lesson',
                        params: { caseName: kasus.key, title: `Video: ${kasus.label}` },
                      } as unknown as Href)
                    }
                    style={{
                      marginTop: space[3],
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: space[2],
                      paddingVertical: space[3],
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: c.accentSoft,
                      backgroundColor: c.accentSoft,
                    }}
                  >
                    <Icon icon={Film} size={16} color="accent" />
                    <ThemedText variant="label" color="accent">
                      Xem video ngữ pháp
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          )
        })}

        {isLoading ? (
          <View style={{ paddingHorizontal: space[5], marginTop: space[5], gap: space[2] }}>
            <Skeleton height={72} radius="2xl" />
            <Skeleton height={72} radius="2xl" />
          </View>
        ) : isError ? (
          <View style={{ marginTop: space[4] }}>
            <ErrorState
              title="Không tải được bài học"
              message="Bảng cách vẫn xem được. Kéo xuống hoặc thử lại để tải bài học ngữ pháp."
              onRetry={() => void refetch()}
            />
          </View>
        ) : topics.length > 0 ? (
          <>
            <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
              <Caption style={{ marginBottom: space[1] }}>Grammatik</Caption>
              <SectionHeader title="Bài học ngữ pháp" />
            </View>
            {topics.map((topic) => (
              <Card key={topic.id} style={{ marginHorizontal: space[5], marginBottom: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] }}>
                  <View style={{ flex: 1, gap: space[1] }}>
                    <ThemedText variant="bodyStrong">{topic.title}</ThemedText>
                    {topic.summary ? (
                      <ThemedText variant="caption" color="muted">
                        {topic.summary}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: space[2] }}>
                    <Pill label={topic.cefrLevel} tone="neutral" />
                    {topic.isCompleted ? <Pill label="Xong" tone="success" icon={Check} /> : null}
                  </View>
                </View>
              </Card>
            ))}
          </>
        ) : (
          <View style={{ marginTop: space[4] }}>
            <EmptyState
              icon={BookOpen}
              title="Chưa có bài học ngữ pháp"
              message="Bảng cách vẫn xem được. Bài học ngữ pháp sẽ xuất hiện ở đây khi có nội dung."
            />
          </View>
        )}
      </Screen>
    </Screen>
  )
}

// Small declension legend chip used on the ink hero (der = blue, die = red,
// das = green) — the gender-colour motif that recurs in the Kasus tables.
function DeclLegend({ label, tone }: { label: string; tone: 'der' | 'die' | 'das' }) {
  const c = useTheme().colors
  const hex = tone === 'der' ? c.der : tone === 'die' ? c.die : c.das
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[2],
        paddingVertical: 5,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c.onInkMuted,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: hex }} />
      <ThemedText variant="caption" style={{ color: c.onInk }}>
        {label}
      </ThemedText>
    </View>
  )
}
