// Theme context. Follows the OS color scheme by default; an explicit override
// (light/dark) can be set and persisted. useTheme() is the single read surface.

import * as SecureStore from 'expo-secure-store'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { darkTheme, lightTheme, type Theme } from './themes'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'df_theme_preference'

interface ThemeContextValue {
  theme: Theme
  preference: ThemePreference
  setPreference: (next: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveTheme(preference: ThemePreference, system: 'light' | 'dark'): Theme {
  const mode = preference === 'system' ? system : preference
  return mode === 'dark' ? darkTheme : lightTheme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const system: 'light' | 'dark' = systemScheme === 'light' ? 'light' : 'dark'
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored)
        }
      })
      .catch(() => {})
  }, [])

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next)
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {})
  }

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: resolveTheme(preference, system), preference, setPreference }),
    [preference, system],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx.theme
}

export function useThemePreference(): Pick<ThemeContextValue, 'preference' | 'setPreference'> {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemePreference must be used within a ThemeProvider')
  }
  return { preference: ctx.preference, setPreference: ctx.setPreference }
}
