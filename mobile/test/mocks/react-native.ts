// Minimal `react-native` stub for ts-jest (node env). The real module ships
// Flow/ESM source that ts-jest can't transform, so any unit test that
// transitively imports it (e.g. lib/api.ts → Platform) fails to load.
// Node-env unit tests only need Platform; extend this as tests require.
export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T>(specifics: { ios?: T; android?: T; native?: T; default?: T }): T | undefined =>
    specifics.ios ?? specifics.native ?? specifics.default,
}
