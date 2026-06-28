const { getDefaultConfig } = require('expo/metro-config')

// Package-exports resolution (unstable_enablePackageExports) is default-on since
// Expo SDK 53, so posthog-react-native@4 subpaths resolve without extra config.
//
// NativeWind (withNativeWind) removed — unused (0 `className` usages) and its
// css-interop layer caused a launch-time render loop under React 19 + New Arch.
module.exports = getDefaultConfig(__dirname)
