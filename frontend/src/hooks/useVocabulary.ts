"use client";

import { useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { toastApiError } from "@/lib/toastApiError";

/**
 * Centralized API error toasts for the student vocabulary browser (`/student/vocabulary`).
 */
export function useVocabulary() {
  const locale = useLocale();

  const notifyApiError = useCallback(
    (err: unknown, onRetry?: () => void) => {
      toastApiError(err, { locale, onRetry });
    },
    [locale],
  );

  return { notifyApiError };
}

/**
 * Stable reload identity for word-list refetch — toast retry handlers and eslint `exhaustive-deps`
 * stay satisfied while each render supplies the latest implementation via ref.
 */
export function useVocabularyReload(impl: () => Promise<void>) {
  const ref = useRef(impl);
  ref.current = impl;
  return useCallback(() => {
    void ref.current();
  }, []);
}
