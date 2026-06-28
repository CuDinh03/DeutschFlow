const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// Package-exports resolution (unstable_enablePackageExports) is default-on since
// Expo SDK 53, so posthog-react-native@4 subpaths resolve without extra config.
const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
