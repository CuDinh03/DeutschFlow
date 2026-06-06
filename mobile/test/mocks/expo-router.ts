// Minimal `expo-router` stub for ts-jest. lib/api.ts imports `router` to
// redirect on 401; node-env unit tests just need the module to load.
export const router = {
  replace: (_href?: unknown): void => {},
  push: (_href?: unknown): void => {},
  navigate: (_href?: unknown): void => {},
  back: (): void => {},
}
