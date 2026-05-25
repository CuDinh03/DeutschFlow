'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            404
          </h1>
          <h2 className="text-3xl font-semibold text-white">
            Seite nicht gefunden
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Die Seite, die Sie suchen, existiert nicht oder wurde verschoben.
          </p>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="text-white border-white hover:bg-white hover:text-black"
          >
            Zurück
          </Button>
          <Button
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
          >
            Zur Startseite
          </Button>
        </div>
      </div>
    </div>
  )
}
