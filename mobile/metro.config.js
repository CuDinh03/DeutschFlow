const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// posthog-react-native@4 + @posthog/core@1 expose subpaths (e.g. @posthog/core/surveys)
// ONLY via the package.json "exports" map. Expo SDK 52's Metro defaults
// unstable_enablePackageExports=false, so Metro uses legacy resolution and can't
// find @posthog/core/surveys → "Unable to resolve module". Honoring exports fixes
// it (this is default-on in Expo SDK 53+).
config.resolver.unstable_enablePackageExports = true

module.exports = withNativeWind(config, { input: './global.css' })
