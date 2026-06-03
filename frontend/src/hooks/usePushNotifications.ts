// Push notification registration for the (retired) Capacitor native build — S20b.
//
// No-op on the web build: the canonical native app is the Expo `mobile/` client, which handles
// push via expo-notifications (see mobile/hooks/usePushNotifications.ts). This stub is kept so the
// existing caller (app/login/page.tsx) compiles unchanged; remove it once that call is dropped.

/** No-op on web — native Capacitor push was retired. */
export async function registerPushNotifications(): Promise<void> {
  // no-op
}
