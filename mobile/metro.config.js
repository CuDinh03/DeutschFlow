const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativeWind } = require('nativewind/metro')

// getSentryExpoConfig is a drop-in for Expo's getDefaultConfig + Sentry's debug-id
// serializer (needed for symbolicated source maps). Package-exports resolution
// (unstable_enablePackageExports) is default-on since Expo SDK 53, so
// posthog-react-native@4 subpaths still resolve without extra config.
const config = getSentryExpoConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
