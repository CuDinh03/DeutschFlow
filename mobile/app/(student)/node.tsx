import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Lock, BookOpen, Sparkles, Quote, Star } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import {
  skillTreeApi,
  type TheoryCard,
  type NodeVocabItem,
  type NodePhrase,
} from '@/lib/skillTreeApi'

// Lesson detail for a skill-tree node: theory cards + vocabulary + phrases.
// The interactive exercises (multi-skill) live on web for now.
export default function NodeScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ nodeId: string; title?: string }>()
  const nodeId = Number(params.nodeId)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['node-session', nodeId],
    queryFn: () => skillTreeApi.getNodeSession(nodeId),
    enabled: Number.isFinite(nodeId),
  })

  const content = data?.content
  const locked = data?.userStatus === 'LOCKED'
  const empty = !content || data?.hasContent === false

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={params.title ?? data?.titleVi ?? 'Bài học'}
        subtitle={data?.cefrLevel ? `${data.cefrLevel}${data.titleDe ? ` · ${data.titleDe}` : ''}` : undefined}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={90} radius="2xl" />
          <Skeleton height={140} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : locked ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon={Lock} title="Chưa mở khoá" message="Hoàn thành các bài trước để mở khoá bài học này." />
        </View>
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon={BookOpen} title="Nội dung đang cập nhật" message="Bài học này chưa có nội dung trên app." />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[2] }}>
          {/* Overview */}
          {content?.overview?.vi ? (
            <Card>
              <ThemedText variant="body" color="secondary">
                {content.overview.vi}
              </ThemedText>
              {data?.xpReward ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space[3] }}>
                  <Icon icon={Star} size={14} color="accent" fill />
                  <ThemedText variant="caption" color="muted">
                    +{data.xpReward} XP khi hoàn thành
                  </ThemedText>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Theory cards */}
          {(content?.theory_cards?.length ?? 0) > 0 ? (
            <Section icon={Sparkles} title="Lý thuyết">
              {content!.theory_cards!.map((card, i) => (
                <TheoryCardView key={i} card={card} />
              ))}
            </Section>
          ) : null}

          {/* Vocabulary */}
          {(content?.vocabulary?.length ?? 0) > 0 ? (
            <Section icon={BookOpen} title={`Từ vựng (${content!.vocabulary!.length})`}>
              <Card style={{ gap: space[3] }}>
                {content!.vocabulary!.map((v, i) => (
                  <VocabRow key={v.id ?? i} item={v} divider={i > 0} />
                ))}
              </Card>
            </Section>
          ) : null}

          {/* Phrases */}
          {(content?.phrases?.length ?? 0) > 0 ? (
            <Section icon={Quote} title="Mẫu câu">
              <Card style={{ gap: space[3] }}>
                {content!.phrases!.map((p, i) => (
                  <PhraseRow key={i} phrase={p} divider={i > 0} />
                ))}
              </Card>
            </Section>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              backgroundColor: c.infoSoft,
              borderRadius: radius.md,
              padding: space[3],
              marginTop: space[2],
            }}
          >
            <Icon icon={Sparkles} size={16} color="info" />
            <ThemedText variant="caption" color="info" style={{ flex: 1 }}>
              Bài tập tương tác (đọc, nghe, nói, viết) hiện làm trên web.
            </ThemedText>
          </View>
        </Screen>
      )}
    </Screen>
  )
}

function Section({ icon, title, children }: { icon: typeof BookOpen; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon icon={icon} size={16} color="accent" />
        <ThemedText variant="label" color="muted">
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  )
}

function TheoryCardView({ card }: { card: TheoryCard }) {
  const title = card.title?.vi ?? card.title?.de
  const body = card.content?.vi ?? card.content?.de
  return (
    <Card style={{ gap: space[2] }}>
      {title ? <ThemedText variant="bodyStrong">{title}</ThemedText> : null}
      {card.title?.de && card.title?.vi ? (
        <ThemedText variant="caption" color="faint">
          {card.title.de}
        </ThemedText>
      ) : null}
      {body ? (
        <ThemedText variant="body" color="secondary">
          {body}
        </ThemedText>
      ) : null}
    </Card>
  )
}

function VocabRow({ item, divider }: { item: NodeVocabItem; divider: boolean }) {
  const c = useTheme().colors
  const gender = item.gender === 'der' || item.gender === 'die' || item.gender === 'das' ? item.gender : null
  return (
    <View style={{ gap: 4, paddingTop: divider ? space[3] : 0, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {gender ? <Pill label={gender} tone={gender} /> : null}
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {item.german}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {item.meaning}
        </ThemedText>
      </View>
      {item.example_de ? (
        <ThemedText variant="caption" color="faint">
          {item.example_de}
          {item.example_vi ? ` — ${item.example_vi}` : ''}
        </ThemedText>
      ) : null}
    </View>
  )
}

function PhraseRow({ phrase, divider }: { phrase: NodePhrase; divider: boolean }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: 2, paddingTop: divider ? space[3] : 0, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
      <ThemedText variant="bodyStrong">{phrase.german}</ThemedText>
      <ThemedText variant="caption" color="muted">
        {phrase.meaning}
      </ThemedText>
    </View>
  )
}
