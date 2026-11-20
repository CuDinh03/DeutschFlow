import { useState } from 'react'
import { View, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { apiMessage } from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Button, EmptyState, ErrorState, Skeleton, VocabGlyphTile, GaGlyph } from '@/components/ui'
import { ArtBadge, Badge, Eyebrow, HeroTitle, ListCard, ListItem, RuledNote, SegTabs, TopBar } from '@/components/learn/HocOnParts'
import { activeLessonTab, lessonEyebrow, lessonTabs, nodeStatusBadge, splitMarkTitle, type LessonTab } from '@/lib/hocOnUi'
import {
  skillTreeApi,
  type TheoryCard,
  type NodeVocabItem,
  type NodePhrase,
} from '@/lib/skillTreeApi'
import { hasAnySkillExercise } from '@/lib/skillExercises'
import { nodeActions } from '@/lib/nodeActions'
import { findNextNode } from '@/lib/nextNode'
import { LessonCompleteNav } from '@/components/LessonCompleteNav'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

// Cap how long markLearned holds the button loading while waiting for the fresh tree that
// feeds "Bài tiếp theo"; a slow tree refetch reveals anyway and nextNode self-heals.
const REVEAL_TREE_CAP_MS = 3000

// Lesson detail for a skill-tree node: theory cards + vocabulary + phrases.
// Giao diện v3.4 (Đợt 6A, mẫu `lesson`): đầu màn có nhãn trạng thái, tiêu đề vệt vàng, thanh chia
// đoạn Lý thuyết | Từ vựng | Mẫu câu. Logic hoàn thành/điều hướng giữ nguyên.
// Nodes with exercises open the practice runner (node-practice.tsx), nodes with skill_exercises
// open the 4-skill runner (skill-practice.tsx), and a node with both offers both (lib/nodeActions).
// Theory-only nodes (no gradeable exercises) complete via the "Đánh dấu đã học" action below.
export default function NodeScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['node'])
  const c = useTheme().colors
  const params = useLocalSearchParams<{ nodeId: string; title?: string }>()
  const nodeId = Number(params.nodeId)
  // Thẻ Lý thuyết / Từ vựng / Mẫu câu đang mở — lưu kèm nodeId vì màn là tab ẩn không unmount
  // (sang bài khác thì tự về thẻ đầu, xem lib/hocOnUi activeLessonTab).
  const [pickedTab, setPickedTab] = useState<{ nodeId: number; tab: LessonTab } | null>(null)

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
  const done = data?.userStatus === 'COMPLETED'
  const hasSkillExercises = hasAnySkillExercise(content?.skill_exercises)
  const actions = nodeActions({ exerciseCount, hasSkillExercises, done })
  const nextNode = done ? findNextNode(tree, nodeId) : undefined

  const qc = useQueryClient()
  const markLearned = useMutation({
    mutationFn: () => skillTreeApi.markNodeComplete(nodeId),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const treeRefresh = qc.invalidateQueries({ queryKey: ['skill-tree'] }).catch(() => {})
      // Lernweg + card Lộ trình đọc /roadmap/me (N1, 05/09) — làm mới cùng lúc với skill-tree.
      void qc.invalidateQueries({ queryKey: ['roadmap-me'] }).catch(() => {})
      // Await node-session fully — it flips this screen to done; the mutation stays pending
      // (button loading) until onSuccess settles, so there's no wrong-state flash or re-tap
      // window. Then wait for the fresh tree that feeds "Bài tiếp theo", but cap it so a slow
      // tree refetch can't hold the button loading indefinitely (nextNode self-heals later).
      await qc.invalidateQueries({ queryKey: ['node-session', nodeId] }).catch(() => {})
      await Promise.race([treeRefresh, new Promise<void>((resolve) => setTimeout(resolve, REVEAL_TREE_CAP_MS))])
    },
    onError: (e) => Alert.alert('Lỗi', apiMessage(e)),
  })

  const title = params.title ?? data?.titleVi ?? 'Bài học'
  const heading = splitMarkTitle(title)
  const eyebrow = lessonEyebrow(data?.cefrLevel, data?.titleDe)
  const badge = nodeStatusBadge(data?.userStatus)
  const tabs = lessonTabs({
    theory: content?.theory_cards?.length ?? 0,
    vocab: content?.vocabulary?.length ?? 0,
    phrases: content?.phrases?.length ?? 0,
  })
  const tab = activeLessonTab(tabs, pickedTab, nodeId)

  return (
    <Screen edges={['top']}>
      <TopBar onBack={goBack} right={data && !locked && !empty ? <Badge label={badge.label} tone={badge.tone} /> : undefined} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[4] }}>
          <Skeleton height={64} radius="lg" />
          <Skeleton height={140} radius="lg" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : locked ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState glyph="khoa" title="Chưa mở khoá" message="Hoàn thành các bài trước để mở khoá bài học này." />
        </View>
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState glyph="doc" title="Nội dung đang cập nhật" message="Bài học này chưa có nội dung trên app." />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], paddingTop: space[4] }}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <HeroTitle lead={heading.lead} mark={heading.mark} style={{ marginTop: space[1] }} />
          {content?.overview?.vi ? (
            <ThemedText variant="body" color="secondary" style={{ marginTop: space[2] }}>
              {content.overview.vi}
            </ThemedText>
          ) : null}
          {data?.xpReward ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2] }}>
              <GaGlyph name="xp" size={15} ink="primary" />
              <ThemedText variant="caption" color="muted">
                +{data.xpReward} XP khi hoàn thành
              </ThemedText>
            </View>
          ) : null}

          {tabs.length > 1 ? (
            <SegTabs tabs={tabs} value={tab} onChange={(k) => setPickedTab({ nodeId, tab: k })} style={{ marginTop: space[4] }} />
          ) : null}

          <View style={{ marginTop: space[3], gap: space[3] }}>
            {tab === 'theory'
              ? content!.theory_cards!.map((card, i) => <TheoryCardView key={i} card={card} />)
              : null}

            {tab === 'vocab' ? (
              <ListCard>
                {content!.vocabulary!.map((v, i) => (
                  <VocabRow key={v.id ?? i} item={v} first={i === 0} />
                ))}
              </ListCard>
            ) : null}

            {tab === 'phrases'
              ? content!.phrases!.map((p, i) => <PhraseRow key={i} phrase={p} />)
              : null}
          </View>

          <View style={{ gap: space[3], marginTop: space[5] }}>
            {actions.doneNav ? (
              <View style={{ gap: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], paddingVertical: space[2] }}>
                  <GaGlyph name="hoanthanh" size={18} ink="success" gold="success" />
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
                  onRoadmap={() => router.replace('/(student)/lernweg')}
                />
              </View>
            ) : null}

            {actions.practice ? (
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
                <ThemedText variant="caption" color="muted" align="center">
                  Trắc nghiệm & điền từ được chấm điểm; dịch & sắp xếp để tự kiểm tra.
                </ThemedText>
              </View>
            ) : null}

            {actions.skills ? (
              // Authored 4-skill set: route to the Nghe/Nói/Đọc/Viết runner (server-graded).
              <View style={{ gap: space[2] }}>
                <Button
                  label="Luyện 4 kỹ năng"
                  variant={actions.practice ? 'secondary' : undefined}
                  onPress={() =>
                    router.push({
                      pathname: '/(student)/skill-practice',
                      params: { nodeId: String(nodeId), title: params.title ?? data?.titleVi ?? 'Luyện tập' },
                    } as unknown as Href)
                  }
                />
                <ThemedText variant="caption" color="muted" align="center">
                  {actions.practice
                    ? 'Nghe · Nói · Đọc · Viết — đạt một trong hai phần là hoàn thành bài, phần còn lại để luyện thêm.'
                    : 'Nghe · Nói · Đọc · Viết — chấm điểm để hoàn thành và mở bài tiếp theo.'}
                </ThemedText>
              </View>
            ) : null}

            {actions.markLearned ? (
              // Theory-only node (no gradeable exercises): explicit "mark as learned" so the lesson
              // can be completed and unlock the next node — otherwise it dead-ends (no practice runner).
              <View style={{ gap: space[2] }}>
                <Button
                  label={markLearned.isPending ? 'Đang lưu…' : 'Đánh dấu đã học'}
                  loading={markLearned.isPending}
                  onPress={() => markLearned.mutate()}
                />
                <ThemedText variant="caption" color="muted" align="center">
                  Đánh dấu để hoàn thành bài lý thuyết và mở khoá bài tiếp theo.
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Screen>
      )}
    </Screen>
  )
}

/** Thẻ lý thuyết (mẫu: `.card` + `.h3` + đoạn giải thích). */
function TheoryCardView({ card }: { card: TheoryCard }) {
  const title = card.title?.vi ?? card.title?.de
  const body = card.content?.vi ?? card.content?.de
  return (
    <Card style={{ gap: space[2] }}>
      {title ? <ThemedText variant="title">{title}</ThemedText> : null}
      {card.title?.de && card.title?.vi ? (
        <ThemedText variant="caption" color="muted" accessibilityLanguage="de-DE">
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

/** Hàng từ vựng (mẫu: `.li` có viên mạo từ, từ tiếng Đức và nghĩa). */
function VocabRow({ item, first }: { item: NodeVocabItem; first: boolean }) {
  const gender = item.gender === 'der' || item.gender === 'die' || item.gender === 'das' ? item.gender : null
  return (
    <ListItem first={first} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 40, alignItems: 'center', paddingTop: 2 }}>
        {gender ? <ArtBadge gender={gender} small /> : <VocabGlyphTile german={item.german} meaning={item.meaning} size={28} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bodyStrong" accessibilityLanguage="de-DE">
          {item.german}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {item.meaning}
        </ThemedText>
        {item.example_de ? (
          <ThemedText variant="caption" color="faint">
            {item.example_de}
            {item.example_vi ? ` — ${item.example_vi}` : ''}
          </ThemedText>
        ) : null}
      </View>
    </ListItem>
  )
}

/** Mẫu câu (mẫu: `.brief` — tờ giấy có lề đỏ). */
function PhraseRow({ phrase }: { phrase: NodePhrase }) {
  return (
    <RuledNote style={{ gap: 2 }}>
      <ThemedText variant="bodyLg" accessibilityLanguage="de-DE">
        {phrase.german}
      </ThemedText>
      <ThemedText variant="caption" color="muted">
        {phrase.meaning}
      </ThemedText>
    </RuledNote>
  )
}
