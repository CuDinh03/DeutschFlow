module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      // Reanimated 4: babel-preset-expo auto-injects 'react-native-worklets/plugin'
      // (react-native-worklets is now installed as a Reanimated 4 peer). Do NOT add the
      // reanimated/worklets plugin manually — declaring it twice errors with "duplicate plugin".
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
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
    ],
  }
}
