module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      // reanimated: false → don't let babel-preset-expo auto-inject the reanimated plugin
      // (this version delegates to 'react-native-worklets/plugin', which isn't installed).
      // The self-contained 'react-native-reanimated/plugin' below handles worklets instead.
      ['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: false }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': '.' },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
