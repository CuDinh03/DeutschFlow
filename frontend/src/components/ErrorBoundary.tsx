'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Fallback UI. Receives `reset` (re-attempt rendering the children) and the
   * caught error so callers can offer escape hatches (retry / submit / go back).
   */
  fallback: (reset: () => void, error: Error) => ReactNode
  /**
   * Side-effect hook for diagnostics (logging / analytics). Called once per catch,
   * after React has already rendered the fallback. MUST NOT throw.
   */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Generic React error boundary. Converts a render/lifecycle crash in any subtree
 * into a recoverable, clickable fallback instead of letting it bubble to the
 * route-level boundary (or, worse, a blank unrecoverable screen).
 *
 * Note: error boundaries only catch errors thrown during render, in lifecycle
 * methods, and in constructors of the children. They do NOT catch errors in
 * event handlers, async code, or the boundary itself — those are surfaced via
 * the global `window` error/unhandledrejection listeners in PostHogProvider.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Always leave a breadcrumb in the console for local/devtools debugging.
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack)
    try {
      this.props.onError?.(error, info)
    } catch {
      // Diagnostics must never mask the original error.
    }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.reset, this.state.error)
    }
    return this.props.children
  }
}
