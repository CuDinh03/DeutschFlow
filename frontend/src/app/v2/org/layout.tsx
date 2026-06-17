import * as React from 'react'
import { GaShell } from '@/components/ui-v2'

/** /v2/org — organization role shell (sidebar + teal roleAccent via data-role). */
export default function V2OrgLayout({ children }: { children: React.ReactNode }) {
  return <GaShell role="org">{children}</GaShell>
}
