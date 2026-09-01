import api, { apiMessage } from '@/lib/api'

/**
 * Nộp bài tập của một node cây học tập để MÁY CHỦ chấm.
 *
 * QA 2026-09-02 (F-22). Frontend không gọi bất kỳ endpoint hoàn thành node nào — không
 * `/skill-tree/{nodeId}/submit`, không `/skill-tree/{nodeId}/skill-exercises/submit`, không
 * `/skill-tree/{nodeId}/complete`. Runner luyện 4 kỹ năng cũng không cứu được: nó chỉ ghi
 * `practice_node_sessions` + XP + SRS, KHÔNG đụng `skill_tree_user_progress` — mà đó mới là bảng
 * `RoadmapService` đọc để ra "x/46". Kết quả: node có bài chấm điểm không có đường hoàn thành nào
 * trên web.
 *
 * Gửi `item_answers` thô để backend tự chấm theo đáp án gốc, đúng ý đồ đã ghi trong
 * `SkillTreeService.submitNodeExercises`: "a tampered client can no longer self-report an inflated
 * score_percent to unlock nodes or bypass paywalled content". `score_percent` chỉ còn là đường lùi
 * cho node không có mục chấm quyết định (SPEAKING/WRITING do AI chấm).
 *
 * Phản chiếu `mobile/lib/skillTreeApi.ts#submitNode` — mobile đã làm đúng từ đầu.
 */

export type NodeSubmitOutcome =
  /** Đạt ngưỡng — node đã COMPLETED trên máy chủ, cây tiến lên. */
  | 'completed'
  /** Máy chủ chấm xong nhưng chưa đạt ngưỡng. KHÔNG phải lỗi, nhưng phải nói cho người học. */
  | 'notPassed'
  /** Node vốn đã hoàn thành từ trước. */
  | 'alreadyDone'
  /** Hỏng thật — phải hiện ra. */
  | 'failed'

export interface NodeSubmitResult {
  outcome: NodeSubmitOutcome
  /** Điểm MÁY CHỦ chấm (không phải điểm client tự tính); null khi không nhận được. */
  scorePercent: number | null
  message: string | null
}

export function classifyNodeSubmitError(status: number, detail: string): NodeSubmitResult {
  if (status === 400 && detail.toLowerCase().includes('đã hoàn thành')) {
    return { outcome: 'alreadyDone', scorePercent: null, message: null }
  }
  return { outcome: 'failed', scorePercent: null, message: detail || null }
}

/** Không bao giờ ném — người gọi đọc `outcome`. */
export async function submitNodeExercises(
  nodeId: number,
  itemAnswers: Record<string, unknown>,
  clientScorePercent: number,
): Promise<NodeSubmitResult> {
  try {
    const { data } = await api.post<{ completed?: boolean; scorePercent?: number }>(
      `/skill-tree/${nodeId}/submit`,
      { score_percent: clientScorePercent, item_answers: itemAnswers },
    )
    const scorePercent = typeof data?.scorePercent === 'number' ? data.scorePercent : null
    return {
      outcome: data?.completed ? 'completed' : 'notPassed',
      scorePercent,
      message: null,
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 0
    return classifyNodeSubmitError(status, apiMessage(err))
  }
}
