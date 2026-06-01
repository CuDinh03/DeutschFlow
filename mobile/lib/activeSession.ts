// Persists a reference to the in-progress practice session so it can be resumed
// after the app is backgrounded or killed (MVP checklist §5.2 "Resume behavior
// works after backgrounding or interruption"). Cleared on clean exit/finish.

import * as SecureStore from 'expo-secure-store'

const ACTIVE_SESSION_KEY = 'df.active_session'

export interface ActiveSessionRef {
  id: number
  interviewPosition: string | null
}

export async function saveActiveSession(ref: ActiveSessionRef): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACTIVE_SESSION_KEY, JSON.stringify(ref))
  } catch {
    // Persistence is best-effort; failure just means no resume offer next launch.
  }
}

export async function loadActiveSession(): Promise<ActiveSessionRef | null> {
  try {
    const raw = await SecureStore.getItemAsync(ACTIVE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveSessionRef
    return typeof parsed?.id === 'number' ? parsed : null
  } catch {
    return null
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACTIVE_SESSION_KEY)
  } catch {
    // ignore
  }
}
