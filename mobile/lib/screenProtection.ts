import { useEffect } from 'react'
import { AppState } from 'react-native'

// Screen-capture protection + app-switcher privacy — S13.
//
// `usePreventScreenCapture` is a GUARDED NO-OP until `expo-screen-capture` is installed (no native
// import → Metro keeps bundling). `useAppBackgrounded` works today (React Native AppState, no dep).

/**
 * Block screenshots / screen recording while a sensitive screen is mounted.
 * Apply on screens showing PII or payment info (e.g. profile, settings, upgrade, exam).
 *
 * To ACTIVATE:
 *   1. `cd mobile && npx expo install expo-screen-capture`
 *   2. Add `import * as ScreenCapture from 'expo-screen-capture'` at the top.
 *   3. Uncomment the body below.
 */
export function usePreventScreenCapture(): void {
  useEffect(() => {
    // --- ACTIVATE after install ---
    // void ScreenCapture.preventScreenCaptureAsync()
    // return () => { void ScreenCapture.allowScreenCaptureAsync() }
  }, [])
}

/**
 * Fires `onChange(true)` when the app leaves the foreground (inactive/background) and
 * `onChange(false)` when it returns. Render an opaque overlay while hidden so app content is not
 * exposed in the OS app-switcher snapshot. Uses RN AppState — works without any extra dependency.
 */
export function useAppBackgrounded(onChange: (hidden: boolean) => void): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      onChange(state !== 'active')
    })
    return () => sub.remove()
  }, [onChange])
}
