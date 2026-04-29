'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { clearTokens } from '@/lib/authSession'

type UseAdminDataOptions<T> = {
  initialData: T
  fetchData: () => Promise<T>
  errorMessage: string
  intervalMs?: number
}

export default function useAdminData<T>({
  initialData,
  fetchData,
  errorMessage,
  intervalMs = 20000,
}: UseAdminDataOptions<T>) {
  const router = useRouter()
  const fetchDataRef = useRef(fetchData)
  const errorMessageRef = useRef(errorMessage)
  const [data, setData] = useState<T>(initialData)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    errorMessageRef.current = errorMessage
  }, [errorMessage])

  const ensureAdmin = useCallback(async () => {
    const me = await api.get('/auth/me')
    if (me.data.role !== 'ADMIN') {
      router.push(`/${String(me.data.role).toLowerCase()}`)
      throw new Error('redirected')
    }
  }, [router])

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      await ensureAdmin()
      const next = await fetchDataRef.current()
      setData(next)
      setLastSyncedAt(new Date())
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'redirected') return
      if (httpStatus(e) === 401) {
        clearTokens()
        router.push('/login')
        return
      }
      setError(errorMessageRef.current)
    } finally {
      if (!silent) setLoading(false)
      setRefreshing(false)
    }
  }, [ensureAdmin, router])

  useEffect(() => {
    reload({ silent: false })
    const id = window.setInterval(() => reload({ silent: true }), intervalMs)
    return () => window.clearInterval(id)
  }, [reload, intervalMs])

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    lastSyncedAt,
    reload,
  }
}

