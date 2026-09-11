// Sentry bọc ngoài config mặc định của Expo: gắn Debug ID vào bundle + source map để Sentry
// khớp stack minified với nguồn (đợt 0 kế hoạch nâng cấp mobile 05/09, N5). Không có lớp này
// thì sourcemap dù upload cũng không symbolicate được. Chỉ đổi cách serialize bundle JS —
// không đụng resolver.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

// Package-exports resolution (unstable_enablePackageExports) is default-on since
// Expo SDK 53, so posthog-react-native@4 subpaths resolve without extra config.
//
// NativeWind (withNativeWind) removed — unused (0 `className` usages) and its
// css-interop layer caused a launch-time render loop under React 19 + New Arch.
module.exports = getSentryExpoConfig(__dirname)
