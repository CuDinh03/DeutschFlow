import { useState } from 'react'
import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, Card, ProgressBar, SelectableChip, ThemedText } from '@/components/ui'
import {
  budgetPartLabel,
  budgetRowDetail,
  budgetRowLabel,
  defaultTarget,
  formatPoints,
  gradeLabel,
  type ExamBudget,
} from '@/lib/examApi'

/**
 * "Ngân sách điểm" trên màn kết quả đề telc (LT1, 22/10/2026) — bản sinh đôi của
 * `frontend/src/components/exam/telc/ExamBudgetPanel.tsx`: điểm đã mất theo Teil (xếp theo điểm,
 * kèm trọng số câu) + mục tiêu xếp loại → được mất tối đa bao nhiêu điểm, một cách chia ví dụ.
 */
export function ExamBudgetCard({ budget }: { budget: ExamBudget }) {
  const { colors: c } = useTheme()
  const [grade, setGrade] = useState<string | null>(() => defaultTarget(budget.targets))
  const target = budget.targets.find((x) => x.grade === grade) ?? null

  return (
    <Card style={{ gap: space[3] }}>
      <Caption>Ngân sách điểm</Caption>
      <ThemedText variant="caption" color="muted">
        Tính trên thang {formatPoints(budget.totalMax)} điểm của cả kỳ thi (viết + nói). Xếp theo số điểm đã mất, không
        theo số câu sai, vì mỗi câu nặng nhẹ khác nhau.
      </ThemedText>

      <ThemedText variant="bodyStrong">
        Đã mất {formatPoints(budget.lost)}/{formatPoints(budget.totalMax)} điểm
        {budget.pending ? ' · chưa gồm phần chưa chấm' : ''}
      </ThemedText>

      <View style={{ gap: space[3] }}>
        {budget.losses.map((row) => {
          const lost = row.lost ?? 0
          return (
            <View key={`${row.section}-${row.teil ?? 'all'}`} style={{ gap: space[1] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                <ThemedText variant="body" style={{ flex: 1 }}>
                  {budgetRowLabel(row)}
                </ThemedText>
                <ThemedText
                  variant="bodyStrong"
                  style={{ color: row.pending ? c.textMuted : lost > 0 ? c.danger : c.success }}
                >
                  {row.pending ? '—' : lost > 0 ? `−${formatPoints(lost)}` : 'Không mất điểm'}
                </ThemedText>
              </View>
              <ProgressBar
                value={!row.pending && row.max > 0 ? lost / row.max : 0}
                height={6}
                fillColor={c.danger}
              />
              <ThemedText variant="caption" color="muted">
                {budgetRowDetail(row)}
              </ThemedText>
            </View>
          )
        })}
      </View>

      {budget.targets.length > 0 ? (
        <View style={{ gap: space[2], borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[3] }}>
          <ThemedText variant="bodyStrong">Mục tiêu xếp loại</ThemedText>
          <ThemedText variant="caption" color="muted">
            Chọn mức bạn muốn đạt để biết được mất tối đa bao nhiêu điểm.
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {budget.targets.map((x) => {
              const on = x.grade === grade
              return (
                <SelectableChip
                  key={x.grade}
                  label={gradeLabel(x.grade)}
                  selected={on}
                  onPress={() => setGrade(x.grade)}
                  style={{
                    borderWidth: 1,
                    borderColor: on ? c.textPrimary : c.border,
                    backgroundColor: on ? c.textPrimary : 'transparent',
                    borderRadius: radius.sm,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                  }}
                >
                  <ThemedText variant="label" style={{ color: on ? c.surface : c.textSecondary }}>
                    {gradeLabel(x.grade)}
                  </ThemedText>
                </SelectableChip>
              )
            })}
          </View>
          {target ? (
            <View style={{ gap: space[1] }}>
              <ThemedText variant="body">
                Để đạt {gradeLabel(target.grade)} (từ {formatPoints(target.minPoints)}/{formatPoints(budget.totalMax)}{' '}
                điểm), bạn được mất tối đa {formatPoints(target.maxLoss)} điểm.
              </ThemedText>
              <ThemedText variant="bodyStrong" style={{ color: target.remaining >= 0 ? c.success : c.danger }}>
                {target.remaining >= 0
                  ? `Bài này đã mất ${formatPoints(budget.lost)} điểm, còn dư ${formatPoints(target.remaining)} điểm.`
                  : `Bài này đã mất ${formatPoints(budget.lost)} điểm, vượt ngân sách ${formatPoints(-target.remaining)} điểm.`}
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ marginTop: space[1] }}>
                Một cách chia ví dụ (vẫn qua cả hai ngưỡng 60 %):
              </ThemedText>
              {target.example.map((s) => (
                <ThemedText key={s.section} variant="caption">
                  {budgetPartLabel(s.section)}: mất tối đa {formatPoints(s.maxLoss)}
                </ThemedText>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
