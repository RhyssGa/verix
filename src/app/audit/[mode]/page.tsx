import { notFound } from 'next/navigation'
import AuditClient from '@/components/AuditClient'

export default function AuditPage({ params }: { params: { mode: string } }) {
  if (params.mode !== 'gerance' && params.mode !== 'copro') {
    notFound()
  }
  return <AuditClient mode={params.mode as 'gerance' | 'copro'} />
}
