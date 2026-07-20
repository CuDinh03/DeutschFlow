import * as SecureStore from 'expo-secure-store'

// Daily study goal (minutes/day) picked in onboarding — stashed on-device so the
// spotlight tour's streak step can echo it back without an extra profile fetch.
// Best-effort: absent/invalid → callers fall back to generic copy.

const KEY = 'df_daily_goal_minutes'

export async function saveDailyGoalMinutes(minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  try {
    await SecureStore.setItemAsync(KEY, String(Math.round(minutes)))
  } catch {
    /* best-effort */
  }
}

export async function getDailyGoalMinutes(): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    const parsed = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}
