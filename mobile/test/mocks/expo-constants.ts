// Minimal `expo-constants` stub for ts-jest. lib/observability.ts đọc `extra.sentryDsn` từ đây;
// gói thật là ESM nên node-env test không nạp được. Trả cấu hình RỖNG có chủ đích: không DSN ⇒
// observability không `require('@sentry/react-native')` ⇒ mọi lời gọi telemetry thành no-op, đúng
// hành vi của một build chưa bật Sentry.
export default {
  expoConfig: { extra: {} as Record<string, unknown> },
}
