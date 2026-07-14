// react-native-svg accepts `className` at runtime (NativeWind / CSS-interop set
// it, and phosphor-react-native's deep-imported icon source passes it to <Svg>).
// The shipped react-native-svg types omit `className`, so `npx tsc --noEmit`
// fails in CI when it compiles phosphor's `src/lib/icon-base.tsx` (<Svg
// className=…>). We deep-import Phosphor from `/src/*` for OTA-safe tree-shaking,
// which pulls that source into the program. Declaring the prop here keeps the
// type-check green without adding NativeWind as a dependency. Runtime is
// unaffected — the prop is already accepted by the native view.
import 'react-native-svg'

declare module 'react-native-svg' {
  interface SvgProps {
    className?: string
  }
}
