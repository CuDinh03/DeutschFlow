'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.push('/login')
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) return null

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900">DeutschFlow</h1>
      <p className="text-gray-500 mt-2">Phase 1 hoàn thành — Auth hoạt động ✓</p>
    </div>
  )
}
