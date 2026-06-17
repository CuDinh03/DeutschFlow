import * as React from 'react'
import { GaShell } from '@/components/ui-v2'

/** /v2/admin — admin role shell (sidebar + navy roleAccent via data-role). */
export default function V2AdminLayout({ children }: { children: React.ReactNode }) {
  return <GaShell role="admin">{children}</GaShell>
}
