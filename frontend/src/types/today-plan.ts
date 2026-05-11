// Aligned with backend TodayPlanDto — GET /api/today/me

export interface RepairTask {
  id: string;
  errorCode: string;
  dueAt: string;
  description?: string;
}

export interface SuggestedLesson {
  id: string;
  title: string;
  type: "vocabulary" | "speaking" | "grammar" | "review";
  estimatedMinutes: number;
  href?: string;
}

export interface ErrorReviewItem {
  id: string;
  mistake: string;
  correction: string;
  category: string;
}

export interface TodayPlanDto {
  userId: string;
  date: string; // ISO Date String
  dailyGoalProgress: number; // 0–100
  streakDays?: number;
  suggestedLessons: SuggestedLesson[];
  errorReviewList: ErrorReviewItem[];
  repairTasksDue?: RepairTask[];
  // raw API fields from backend TodayPlanDto
  rollingAccuracyPercent?: number;
  suggestedTopic?: string;
  suggestedCefr?: string;
}
