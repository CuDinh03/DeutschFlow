import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { Lock, BookOpen, Sparkles, Quote, Star } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Pill,
  Button,
  AppHeader,
  Caption,
  YellowSquare,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
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
  const exerciseCount =
    (content?.exercises?.theory_gate?.length ?? 0) + (content?.exercises?.practice?.length ?? 0)
  const inProgress = data?.userStatus === 'IN_PROGRESS'
  const done = data?.userStatus === 'COMPLETED'

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={params.title ?? data?.titleVi ?? 'Bài học'}
        subtitle={data?.cefrLevel ? `${data.cefrLevel}${data.titleDe ? ` · ${data.titleDe}` : ''}` : undefined}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={120} radius="md" />
          <Skeleton height={140} radius="md" />
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
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[5], paddingTop: space[2] }}>
          {/* Overview — editorial ink hero: the lede + key reward for this lesson */}
          {content?.overview?.vi ? (
            <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] }}>
                <Pill label={done ? 'Đã hoàn thành' : inProgress ? 'Đang học' : 'Bắt đầu'} tone="accent" solid />
                {data?.cefrLevel ? <Caption color={c.onInkMuted}>{data.cefrLevel}</Caption> : null}
              </View>
              <Caption color={c.accent}>Tổng quan</Caption>
              <ThemedText variant="bodyLg" style={{ color: c.onInk, marginTop: 6 }}>
                {content.overview.vi}
              </ThemedText>
              {data?.xpReward ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[2],
                    marginTop: space[4],
                    paddingTop: space[3],
                    borderTopWidth: 1,
                    borderTopColor: c.accentSoft,
                  }}
                >
                  <Icon icon={Star} size={15} color="accent" fill />
                  <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
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
            <Section icon={BookOpen} title={`Từ vựng · ${content!.vocabulary!.length}`}>
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

          {exerciseCount > 0 ? (
            <View style={{ gap: space[2] }}>
              <Button
                label={`Bắt đầu luyện tập (${exerciseCount} câu)`}
                onPress={() =>
                  router.push({
                    pathname: '/(student)/node-practice',
                    params: { nodeId: String(nodeId), title: params.title ?? data?.titleVi ?? 'Luyện tập' },
                  } as unknown as Href)
                }
              />
              <ThemedText variant="caption" color="faint" align="center">
                Trắc nghiệm & điền từ được chấm điểm; dịch & sắp xếp để tự kiểm tra.
              </ThemedText>
            </View>
          ) : null}
        </Screen>
      )}
    </Screen>
  )
}

function Section({ icon, title, children }: { icon: typeof BookOpen; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <YellowSquare size={7} />
        <Icon icon={icon} size={14} color="accent" />
        <Caption>{title}</Caption>
      </View>
      {children}
    </View>
  )
}

function TheoryCardView({ card }: { card: TheoryCard }) {
  const c = useTheme().colors
  const title = card.title?.vi ?? card.title?.de
  const body = card.content?.vi ?? card.content?.de
  return (
    <Card style={{ gap: space[2] }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={{ width: 4, height: 18, borderRadius: radius.sm, backgroundColor: c.accent }} />
          <ThemedText variant="title" style={{ flex: 1 }}>
            {title}
          </ThemedText>
        </View>
      ) : null}
      {card.title?.de && card.title?.vi ? (
        <Caption color={c.textFaint}>{card.title.de}</Caption>
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
