import { useCallback, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, type Href } from 'expo-router'
import { Check, ChevronRight, Lock, Medal, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText, YellowSquare,
} from '@/components/ui'
import { lernwegApi, ROADMAP_ME_QUERY_KEY } from '@/lib/lernwegApi'
import { buildLernwegTree, skillLabel, type LernwegLeaf, type LernwegLevel } from '@/lib/lernwegTree'

/**
 * Lernweg — bản đồ lộ trình THẬT từ `GET /roadmap/me` (từ 05/09, N1 plan nâng cấp
 * mobile): level → tuần → lá = node giáo trình, cùng dữ liệu và cùng sổ tiến độ với
 * web /v2/student/roadmap và với player node.tsx của chính app. Chạm lá mở thẳng bài
 * (node.tsx) — không còn "đợt sau"; hoàn thành bài ở đó là lá đổi trạng thái ở đây
 * (các màn học invalidate ROADMAP_ME_QUERY_KEY, và màn này refetch khi được focus).
 *
 * Trước 05/09 màn đọc /roadmap/tree = cây DEMO web đã bỏ từ 03/08 → tài khoản A2
 * thấy "A0 · Gieo mầm" rỗng (AC-MOBSCR-06 FAIL). Thiết kế thị giác (dấu lá 4
 * trạng thái, chú giải, sheet) giữ nguyên bản đã chốt 02/09.
 */
export default function LernwegScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [sheetLeaf, setSheetLeaf] = useState<LernwegLeaf | null>(null)

  const treeQ = useQuery({
    queryKey: ROADMAP_ME_QUERY_KEY,
    queryFn: () => lernwegApi.nodes(),
    staleTime: 30_000,
  })

  // Màn nằm dưới Tabs nên không unmount khi rời đi — refetch lúc quay lại để lá vừa
  // học xong đổi trạng thái (react-query trong RN không có focus cửa sổ để tự làm).
  const refetch = treeQ.refetch
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const tree = treeQ.data ? buildLernwegTree(treeQ.data) : null

  function openLeaf(leaf: LernwegLeaf) {
    setSheetLeaf(leaf)
  }

  function closeSheet() {
    setSheetLeaf(null)
  }

  function goStudy(leaf: LernwegLeaf) {
    closeSheet()
    router.push({
      pathname: '/(student)/node',
      params: { nodeId: String(leaf.id), title: leaf.title },
    } as unknown as Href)
  }

  function goPractice(leaf: LernwegLeaf) {
    closeSheet()
    router.push({
      pathname: '/(student)/skill-practice',
      params: { nodeId: String(leaf.id) },
    } as unknown as Href)
  }

  function LeafDot({ leaf }: { leaf: Pick<LernwegLeaf, 'state'> }) {
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

  function stateWord(state: LernwegLeaf['state']): string {
    switch (state) {
      case 'completed': return 'đã xong'
      case 'in_progress': return 'đang học'
      case 'available': return 'học được'
      default: return 'chưa mở'
    }
  }

  function LevelSection({ level }: { level: LernwegLevel }) {
    if (level.status === 'locked') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <View style={{ width: 28, height: 28, borderRadius: radius.full, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Lock} size={12} color="faint" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bodyStrong" color="muted">{`${level.level} · ${level.total} bài`}</ThemedText>
            {level.unlocksWhen ? (
              <ThemedText variant="caption" color="faint">{level.unlocksWhen}</ThemedText>
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
          <ThemedText variant="bodyStrong" style={{ flex: 1 }}>{`${level.level} — đã hoàn thành ${level.done}/${level.total} bài`}</ThemedText>
        </View>
      )
    }
    // current — mở rộng đầy đủ
    return (
      <View style={{ gap: space[3] }}>
        <View style={{ alignSelf: 'center', backgroundColor: c.inkSurface, borderRadius: radius.full, paddingHorizontal: space[4], paddingVertical: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <YellowSquare />
          <ThemedText variant="label" style={{ color: c.onInk }}>{`Đang học · ${level.level} · ${level.done}/${level.total}`}</ThemedText>
        </View>

        {level.branches.map((branch) => (
          <View key={branch.key} style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Caption style={{ flex: 1 }}>{`${branch.label} · ${branch.sublabel}`}</Caption>
              <Pill
                label={branch.status === 'matured' ? 'ĐỦ LÁ' : branch.status === 'growing' ? 'ĐANG LỚN' : 'CHƯA MỞ'}
                tone={branch.status === 'matured' ? 'success' : branch.status === 'growing' ? 'accent' : 'neutral'}
              />
            </View>
            <Card style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], alignItems: 'flex-start' }}>
                {branch.leaves.map((leaf) => (
                  <Pressable
                    key={leaf.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${leaf.day != null ? `Ngày ${leaf.day}, ` : ''}${leaf.title} — ${stateWord(leaf.state)}`}
                    accessibilityState={{ disabled: leaf.state === 'locked' }}
                    onPress={() => openLeaf(leaf)}
                    disabled={leaf.state === 'locked'}
                    hitSlop={6}
                    style={{ alignItems: 'center', gap: 4, width: 44 }}
                  >
                    <View style={{ height: 40, justifyContent: 'center' }}>
                      <LeafDot leaf={leaf} />
                    </View>
                    <ThemedText variant="caption" color={leaf.state === 'locked' ? 'faint' : 'secondary'}>
                      {leaf.day != null ? String(leaf.day) : leaf.emoji || '·'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </Card>
          </View>
        ))}
      </View>
    )
  }

  const skills = sheetLeaf ? Object.entries(sheetLeaf.skillCounts).filter(([, n]) => n > 0) : []

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Lernweg"
        subtitle={tree?.currentLevel ? `${tree.currentLevel} · con đường của bạn` : undefined}
        onBack={() => router.back()}
        right={
          tree && tree.total > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <YellowSquare />
              <ThemedText variant="label">{`${tree.done}/${tree.total}`}</ThemedText>
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
      ) : tree.total === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[6] }}>
          <ThemedText variant="body" color="secondary" align="center">
            Lộ trình của bạn chưa có bài nào — hoàn tất bước chọn trình độ ở Hồ sơ để mở đường học.
          </ThemedText>
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
          {tree.levels.map((level) => <LevelSection key={level.level} level={level} />)}

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
                  <LeafDot leaf={{ state }} />
                </View>
                <ThemedText variant="caption" color="secondary">{label}</ThemedText>
              </View>
            ))}
          </View>
        </Screen>
      )}

      {/* Sheet chi tiết lá — một CTA chính (Học bài), luyện 4 kỹ năng là hành động phụ */}
      <Modal visible={sheetLeaf != null} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(22,21,19,0.35)' }} accessibilityLabel="Đóng" onPress={closeSheet} />
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: space[5], paddingBottom: space[8], gap: space[4] }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, backgroundColor: c.borderStrong }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            {sheetLeaf ? <LeafDot leaf={sheetLeaf} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Caption>
                {sheetLeaf?.day != null ? `Ngày ${sheetLeaf.day}` : 'Bài học'}
                {sheetLeaf?.emoji ? ` ${sheetLeaf.emoji}` : ''}
              </Caption>
              <ThemedText variant="titleLg">{sheetLeaf?.title ?? ''}</ThemedText>
              {sheetLeaf?.titleDe && sheetLeaf.titleDe !== sheetLeaf.title ? (
                <ThemedText variant="caption" color="secondary">{sheetLeaf.titleDe}</ThemedText>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={closeSheet} hitSlop={8}>
              <Icon icon={X} size={20} color="secondary" />
            </Pressable>
          </View>

          {sheetLeaf ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] }}>
                {sheetLeaf.state === 'completed' ? <Pill label="ĐÃ XONG" tone="success" /> : null}
                {sheetLeaf.state === 'in_progress' ? <Pill label="ĐANG HỌC" tone="accent" /> : null}
                {sheetLeaf.xpReward > 0 ? <Pill label={`+${sheetLeaf.xpReward} XP`} tone="neutral" /> : null}
                {sheetLeaf.lessonsTotal > 0 ? (
                  <Pill label={`${sheetLeaf.lessonsCompleted}/${sheetLeaf.lessonsTotal} PHẦN`} tone="neutral" />
                ) : null}
              </View>
              {skills.length > 0 ? (
                <ThemedText variant="caption" color="secondary">
                  {`Luyện: ${skills.map(([k, n]) => `${skillLabel(k)} ${n}`).join(' · ')}`}
                </ThemedText>
              ) : null}
              {sheetLeaf.description ? (
                <ThemedText variant="body" color="secondary">{sheetLeaf.description}</ThemedText>
              ) : null}
              <Button
                label={sheetLeaf.state === 'completed' ? 'Ôn lại bài' : 'Học bài'}
                onPress={() => goStudy(sheetLeaf)}
              />
              {skills.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Luyện 4 kỹ năng của bài này"
                  onPress={() => goPractice(sheetLeaf)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'center', paddingVertical: space[1] }}
                >
                  <ThemedText variant="caption" color="secondary">Luyện 4 kỹ năng của bài này</ThemedText>
                  <Icon icon={ChevronRight} size={14} color="secondary" />
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>
      </Modal>
    </Screen>
  )
}
