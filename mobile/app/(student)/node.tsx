import type { ReactNode } from 'react'
import { View, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Lock, BookOpen, Sparkles, Quote, Star, CircleCheck } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
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
  VocabGlyphTile,
} from '@/components/ui'
import {
  skillTreeApi,
  type TheoryCard,
  type NodeVocabItem,
  type NodePhrase,
} from '@/lib/skillTreeApi'
import { hasAnySkillExercise } from '@/lib/skillExercises'
import { findNextNode } from '@/lib/nextNode'
import { LessonCompleteNav } from '@/components/LessonCompleteNav'

// Cap how long markLearned holds the button loading while waiting for the fresh tree that
// feeds "Bài tiếp theo"; a slow tree refetch reveals anyway and nextNode self-heals.
const REVEAL_TREE_CAP_MS = 3000

// Lesson detail for a skill-tree node: theory cards + vocabulary + phrases.
// Nodes with exercises open the practice runner (node-practice.tsx); theory-only nodes
// (no gradeable exercises) complete via the "Đánh dấu đã học" action below.
export default function NodeScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ nodeId: string; title?: string }>()
  const nodeId = Number(params.nodeId)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['node-session', nodeId],
    queryFn: () => skillTreeApi.getNodeSession(nodeId),
    enabled: Number.isFinite(nodeId),
  })

  // Observe the skill tree so "Bài tiếp theo" can be derived (never held as stale state):
  // it stays correct whether the node was just completed this session or opened already
  // done from the roadmap, and refreshes when markLearned invalidates the tree below.
  const { data: tree = [] } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => skillTreeApi.getMySkillTree(),
    staleTime: 120_000,
  })

  const content = data?.content
  const locked = data?.userStatus === 'LOCKED'
  const empty = !content || data?.hasContent === false
  const exerciseCount =
    (content?.exercises?.theory_gate?.length ?? 0) + (content?.exercises?.practice?.length ?? 0)
  const inProgress = data?.userStatus === 'IN_PROGRESS'
  const done = data?.userStatus === 'COMPLETED'
  const hasSkillExercises = hasAnySkillExercise(content?.skill_exercises)
  const nextNode = done ? findNextNode(tree, nodeId) : undefined

  const qc = useQueryClient()
  const markLearned = useMutation({
    mutationFn: () => skillTreeApi.markNodeComplete(nodeId),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const treeRefresh = qc.invalidateQueries({ queryKey: ['skill-tree'] }).catch(() => {})
      // Await node-session fully — it flips this screen to done; the mutation stays pending
      // (button loading) until onSuccess settles, so there's no wrong-state flash or re-tap
      // window. Then wait for the fresh tree that feeds "Bài tiếp theo", but cap it so a slow
      // tree refetch can't hold the button loading indefinitely (nextNode self-heals later).
      await qc.invalidateQueries({ queryKey: ['node-session', nodeId] }).catch(() => {})
      await Promise.race([treeRefresh, new Promise<void>((resolve) => setTimeout(resolve, REVEAL_TREE_CAP_MS))])
    },
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={params.title ?? data?.titleVi ?? 'Bài học'}
        subtitle={data?.cefrLevel ? `${data.cefrLevel}${data.titleDe ? ` · ${data.titleDe}` : ''}` : undefined}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(student)/roadmap'))}
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
          ) : done ? (
            <View style={{ gap: space[3] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[2],
                  paddingVertical: space[2],
                }}
              >
                <Icon icon={CircleCheck} size={18} color="success" />
                <ThemedText variant="bodyStrong" style={{ color: c.success }}>
                  Đã hoàn thành bài học
                </ThemedText>
              </View>
              <LessonCompleteNav
                onNext={
                  nextNode
                    ? () =>
                        router.replace({
                          pathname: '/(student)/node',
                          params: { nodeId: String(nextNode.id), title: nextNode.title },
                        } as unknown as Href)
                    : undefined
                }
                onRoadmap={() => router.replace('/(student)/roadmap')}
              />
            </View>
          ) : hasSkillExercises ? (
            // Authored 4-skill node: route to the Nghe/Nói/Đọc/Viết runner (server-graded).
            <View style={{ gap: space[2] }}>
              <Button
                label="Bắt đầu luyện 4 kỹ năng"
                onPress={() =>
                  router.push({
                    pathname: '/(student)/skill-practice',
                    params: { nodeId: String(nodeId), title: params.title ?? data?.titleVi ?? 'Luyện tập' },
                  } as unknown as Href)
                }
              />
              <ThemedText variant="caption" color="faint" align="center">
                Nghe · Nói · Đọc · Viết — chấm điểm để hoàn thành và mở bài tiếp theo.
              </ThemedText>
            </View>
          ) : (
            // Theory-only node (no gradeable exercises): explicit "mark as learned" so the lesson
            // can be completed and unlock the next node — otherwise it dead-ends (no practice runner).
            <View style={{ gap: space[2] }}>
              <Button
                label={markLearned.isPending ? 'Đang lưu…' : 'Đánh dấu đã học'}
                loading={markLearned.isPending}
                onPress={() => markLearned.mutate()}
              />
              <ThemedText variant="caption" color="faint" align="center">
                Đánh dấu để hoàn thành bài lý thuyết và mở khoá bài tiếp theo.
              </ThemedText>
            </View>
          )}
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
        {/* Fixed 36px slot keeps rows left-aligned whether or not the word has
            an icon (VocabGlyphTile renders null for abstract words). */}
        <View style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
          <VocabGlyphTile german={item.german} meaning={item.meaning} size={36} />
        </View>
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
