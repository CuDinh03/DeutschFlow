module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      // Reanimated 4: babel-preset-expo auto-injects 'react-native-worklets/plugin'
      // (react-native-worklets is now installed as a Reanimated 4 peer). Do NOT add the
      // reanimated/worklets plugin manually — declaring it twice errors with "duplicate plugin".
      //
      // NativeWind removed: the app uses inline styles + the lib/theme token system
      // exclusively (0 `className` usages). NativeWind's `jsxImportSource` made
      // react-native-css-interop globally wrap every JSX element, which drove a
      // `@react-navigation/core` useSyncState infinite re-render loop under React 19 +
      // the New Architecture ("Maximum update depth exceeded" at launch).
      'babel-preset-expo',
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
