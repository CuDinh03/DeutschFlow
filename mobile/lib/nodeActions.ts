// Pure rules for what the lesson screen (node.tsx) offers. A node can carry two graded sets:
// `exercises` (node-practice) and `skill_exercises` (skill-practice). Passing EITHER one completes
// the node (SkillTreeService), so a node with both keeps both runners open after completion; the
// server grades the second one as extra practice, with no XP and no progress write.

export interface NodeActions {
  practice: boolean
  skills: boolean
  markLearned: boolean
  doneNav: boolean
}

export function nodeActions({
  exerciseCount,
  hasSkillExercises,
  done,
}: {
  exerciseCount: number
  hasSkillExercises: boolean
  done: boolean
}): NodeActions {
  const practice = exerciseCount > 0
  const both = practice && hasSkillExercises
  return {
    practice,
    skills: both || (hasSkillExercises && !done),
    markLearned: !practice && !hasSkillExercises && !done,
    // A node with only `exercises` keeps its runner button after completion and shows no nav.
    doneNav: done && (both || !practice),
  }
}

/** Result headline for a graded run; a run on an already-completed node earns nothing. */
export function completionTitle(xp: number, alreadyCompleted: boolean): string {
  return alreadyCompleted ? 'Đã luyện thêm xong' : `Tuyệt vời! +${xp} XP`
}

export function completionCaption(hasNext: boolean, alreadyCompleted: boolean): string {
  if (alreadyCompleted) return 'Bài đã hoàn thành từ trước nên lần này không cộng XP.'
  return hasNext ? 'Bài học đã mở khoá bài tiếp theo trên lộ trình.' : 'Bạn đã hoàn thành mọi bài đang mở khoá.'
}
