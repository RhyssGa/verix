import { notFound } from 'next/navigation'
import { use } from 'react'
import { AuditPage } from '@/components/audit/AuditPage'

export default function AuditRoute({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = use(params)
  if (mode !== 'gerance' && mode !== 'copro') {
    notFound()
  }
  return <AuditPage mode={mode as 'gerance' | 'copro'} />
}
