// Minimal `react-native` stub for ts-jest (node env). The real module ships
// Flow/ESM source that ts-jest can't transform, so any unit test that
// transitively imports it (e.g. lib/api.ts → Platform) fails to load.
// Node-env unit tests only need Platform; extend this as tests require.
import type { ReactNode } from 'react'

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T>(specifics: { ios?: T; android?: T; native?: T; default?: T }): T | undefined =>
    specifics.ios ?? specifics.native ?? specifics.default,
}

// Primitive components as inert element types: component tests build the element tree by
// calling the component function directly and walk `props.children` — nothing is rendered,
// so the stubs never run. (No react-test-renderer / react-dom in this project.)
type StubProps = { children?: ReactNode } & Record<string, unknown>
const stub = (_props: StubProps): null => null

export const View = stub
export const Text = stub
export const Modal = stub
export const Pressable = stub
export const ScrollView = stub

// Alert as a spy target (`jest.spyOn(Alert, 'alert')`) — lib/upsell.ts and screens call it
// straight from the catch block of AI calls.
export const Alert = {
  alert: (..._args: unknown[]): void => {},
}
