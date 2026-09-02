import { useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Check, ChevronRight, Lock, Medal, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText, YellowSquare,
} from '@/components/ui'
import { lernwegApi, type TreeLeaf, type TreeLevel, type TreeNodeLesson } from '@/lib/lernwegApi'
import { currentLevel, milestoneLabel, skillPracticeRoute, treeProgress } from '@/lib/lernwegUi'

/**
 * Lernweg v2 (cụm 3/3 — thiết kế đã chốt 02/09): bản đồ cây học tập THẬT từ
 * /roadmap/tree — hợp nhất mental model với web (màn roadmap cũ dùng hệ
 * skill-tree khác, giữ nguyên cho các luồng đang chạy; entry Trang chủ trỏ sang
 * đây). Đợt này là bản đồ tiến độ + lối vào luyện theo kỹ năng; player bài học
 * theo contentKey (web §5) là đợt sau — không completeNode từ mobile khi chưa
 * học thật.
 */
export default function LernwegScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [sheetLeaf, setSheetLeaf] = useState<TreeLeaf | null>(null)
  const [sheetLesson, setSheetLesson] = useState<TreeNodeLesson | null>(null)
  const [sheetLoading, setSheetLoading] = useState(false)

  const treeQ = useQuery({
    queryKey: ['lernweg-tree'],
    queryFn: () => lernwegApi.tree(),
    staleTime: 60_000,
  })

  const tree = treeQ.data
  const progress = treeProgress(tree)
  const cur = currentLevel(tree)

  async function openLeaf(leaf: TreeLeaf) {
    if (leaf.state === 'locked') return
    setSheetLeaf(leaf)
    setSheetLesson(null)
    setSheetLoading(true)
    try {
      setSheetLesson(await lernwegApi.node(leaf.id))
    } catch {
      // Sheet vẫn mở với tiêu đề leaf — thiếu mô tả không chặn lối luyện.
    } finally {
      setSheetLoading(false)
    }
  }

  function closeSheet() {
    setSheetLeaf(null)
    setSheetLesson(null)
  }

  function LeafDot({ leaf }: { leaf: TreeLeaf }) {
    const base = { alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: radius.full }
    if (leaf.state === 'completed') {
      return (
        <View style={[base, { width: 34, height: 34, backgroundColor: c.accent, borderWidth: 1.5, borderColor: c.accentText }]}>
          <Icon icon={Check} size={16} color="onAccent" strokeWidth={3} />
        </View>
      )
    }
    if (leaf.state === 'in_progress') {
      return (
        <View style={[base, { width: 40, height: 40, borderWidth: 2, borderStyle: 'dashed', borderColor: c.accentText }]}>
          <View style={[base, { width: 28, height: 28, backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent }]} />
        </View>
      )
    }
    if (leaf.state === 'available') {
      return (
        <View style={[base, { width: 34, height: 34, backgroundColor: c.surface, borderWidth: 2, borderColor: c.accentText }]}>
          <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: c.accent }} />
        </View>
      )
    }
    return (
      <View style={[base, { width: 28, height: 28, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.borderStrong }]}>
        <Icon icon={Lock} size={11} color="faint" />
      </View>
    )
  }

  function LevelSection({ level }: { level: TreeLevel }) {
    if (level.status === 'locked') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <View style={{ width: 28, height: 28, borderRadius: radius.full, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Lock} size={12} color="faint" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bodyStrong" color="muted">{level.level}</ThemedText>
            {level.milestone?.unlocksWhen ? (
              <ThemedText variant="caption" color="faint">{level.milestone.unlocksWhen}</ThemedText>
            ) : null}
          </View>
        </View>
      )
    }
    if (level.status === 'completed') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <View style={{ width: 28, height: 28, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Medal} size={14} color="onAccent" />
          </View>
          <ThemedText variant="bodyStrong" style={{ flex: 1 }}>{`${level.level} — đã hoàn thành`}</ThemedText>
        </View>
      )
    }
    // current — mở rộng đầy đủ
    return (
      <View style={{ gap: space[3] }}>
        <View style={{ alignSelf: 'center', backgroundColor: c.inkSurface, borderRadius: radius.full, paddingHorizontal: space[4], paddingVertical: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <YellowSquare />
          <ThemedText variant="label" style={{ color: c.onInk }}>{`Đang học · ${level.level}`}</ThemedText>
        </View>

        {level.milestone && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'center' }}>
            <ThemedText variant="caption" color="secondary">{level.milestone.title}</ThemedText>
            <Pill
              label={milestoneLabel(level.milestone.state)}
              tone={level.milestone.state === 'ready' ? 'accent' : level.milestone.state === 'passed' ? 'success' : 'neutral'}
            />
          </View>
        )}

        {level.branches.map((branch) => (
          <View key={branch.skill} style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Caption style={{ flex: 1 }}>{branch.label}</Caption>
              <Pill
                label={branch.status === 'matured' ? 'ĐỦ LÁ' : branch.status === 'growing' ? 'ĐANG LỚN' : 'CHƯA MỞ'}
                tone={branch.status === 'matured' ? 'success' : branch.status === 'growing' ? 'accent' : 'neutral'}
              />
            </View>
            <Card style={{ gap: space[3] }}>
              {branch.shoots.map((shoot) => (
                <View key={shoot.topicId} style={{ gap: space[2] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    {shoot.chosenByUser ? <YellowSquare size={5} /> : null}
                    <ThemedText variant={shoot.chosenByUser ? 'bodyStrong' : 'body'} color={shoot.chosenByUser ? 'primary' : 'secondary'} style={{ flex: 1 }}>
                      {shoot.topicLabel}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' }}>
                    {shoot.nodes.map((leaf) => (
                      <Pressable
                        key={leaf.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${leaf.title} — ${leaf.state === 'completed' ? 'đã xong' : leaf.state === 'locked' ? 'chưa mở' : 'học được'}`}
                        accessibilityState={{ disabled: leaf.state === 'locked' }}
                        onPress={() => void openLeaf(leaf)}
                        disabled={leaf.state === 'locked'}
                        hitSlop={6}
                      >
                        <LeafDot leaf={leaf} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ))}
      </View>
    )
  }

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Lernweg"
        subtitle={tree ? `${tree.user.currentLevel} · con đường của bạn` : undefined}
        onBack={() => router.back()}
        right={
          progress.total > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <YellowSquare />
              <ThemedText variant="label">{`${progress.done}/${progress.total}`}</ThemedText>
            </View>
          ) : undefined
        }
      />

      {treeQ.isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={60} radius="full" />
          <Skeleton height={320} radius="2xl" />
        </View>
      ) : treeQ.isError || !tree ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => void treeQ.refetch()} />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
          {tree.path.map((level) => <LevelSection key={level.level} level={level} />)}

          {/* Chú giải — khớp đúng hình vẽ của LeafDot */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4], justifyContent: 'center', paddingTop: space[2] }}>
            {([
              ['đã nở', 'completed'],
              ['đang học', 'in_progress'],
              ['sẵn sàng', 'available'],
              ['chưa mở', 'locked'],
            ] as const).map(([label, state]) => (
              <View key={state} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 }}>
                <View style={{ transform: [{ scale: 0.55 }] }}>
                  <LeafDot leaf={{ id: state, title: label, state }} />
                </View>
                <ThemedText variant="caption" color="secondary">{label}</ThemedText>
              </View>
            ))}
          </View>
        </Screen>
      )}

      {/* Sheet chi tiết lá */}
      <Modal visible={sheetLeaf != null} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(22,21,19,0.35)' }} accessibilityLabel="Đóng" onPress={closeSheet} />
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: space[5], paddingBottom: space[8], gap: space[4] }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, backgroundColor: c.borderStrong }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            {sheetLeaf ? <LeafDot leaf={sheetLeaf} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              {sheetLesson?.topicLabel ? <Caption>{sheetLesson.topicLabel}</Caption> : null}
              <ThemedText variant="titleLg">{sheetLesson?.title ?? sheetLeaf?.title ?? ''}</ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={closeSheet} hitSlop={8}>
              <Icon icon={X} size={20} color="secondary" />
            </Pressable>
          </View>

          {sheetLoading ? (
            <Skeleton height={44} radius="lg" />
          ) : (
            <>
              {sheetLesson?.skill ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Pill label={sheetLesson.skill} tone="accent" />
                  {sheetLeaf?.state === 'completed' ? <Pill label="ĐÃ XONG" tone="success" /> : null}
                </View>
              ) : null}
              <Button
                label={sheetLeaf?.state === 'completed' ? 'Ôn lại kỹ năng này' : 'Luyện kỹ năng này'}
                onPress={() => {
                  const route = skillPracticeRoute(sheetLesson?.skill ?? '')
                  closeSheet()
                  router.push(route)
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon icon={ChevronRight} size={14} color="faint" />
                <ThemedText variant="caption" color="faint" style={{ flex: 1 }}>
                  Bài học đầy đủ của nhánh này đang có trên bản web — app sẽ có ở bản sau.
                </ThemedText>
              </View>
            </>
          )}
        </View>
      </Modal>
    </Screen>
  )
}
