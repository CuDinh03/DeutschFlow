import { useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ChevronDown, ChevronUp, Check } from 'lucide-react-native'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, SectionHeader, ErrorState, Skeleton } from '@/components/ui'
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

export default function GrammarScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [expandedCase, setExpandedCase] = useState<string | null>('nominativ')

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
        <View style={{ paddingHorizontal: space[5] }}>
          <SectionHeader title="Bảng cách (Kasus)" />
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
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: c.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ThemedText variant="mono" color="accent">
                      {kasus.key.slice(0, 2).toUpperCase()}
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
                  <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border }}>
                      {TABLE_HEADERS.map((h, i) => (
                        <View key={i} style={{ flex: 1, padding: space[2] }}>
                          <ThemedText variant="caption" color="muted" align="center">
                            {h}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ flex: 1, padding: space[2] }}>
                        <ThemedText variant="caption" color="muted" align="center">
                          best.
                        </ThemedText>
                      </View>
                      {[row.der, row.die, row.das, row.plural].map((v, i) => (
                        <View key={i} style={{ flex: 1, padding: space[2] }}>
                          <ThemedText variant="mono" color="accent" align="center">
                            {v}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
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
            <View style={{ paddingHorizontal: space[5], marginTop: space[5] }}>
              <SectionHeader title="Bài học ngữ pháp" />
            </View>
            {topics.map((topic) => (
              <Card key={topic.id} style={{ marginHorizontal: space[5], marginBottom: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[1] }}>
                  <ThemedText variant="bodyStrong" style={{ flex: 1, marginRight: space[2] }}>
                    {topic.title}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Pill label={topic.cefrLevel} tone="neutral" />
                    {topic.isCompleted ? (
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: radius.full,
                          backgroundColor: c.successSoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon icon={Check} size={12} color="success" />
                      </View>
                    ) : null}
                  </View>
                </View>
                <ThemedText variant="caption" color="muted">
                  {topic.summary}
                </ThemedText>
              </Card>
            ))}
          </>
        ) : null}
      </Screen>
    </Screen>
  )
}
