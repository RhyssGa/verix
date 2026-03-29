import type { Metadata } from 'next'
import { ReportingPage } from '@/components/reporting/ReportingPage'

export const metadata: Metadata = {
  title: 'Reporting groupe — Century 21',
}

export default function Page() {
  return <ReportingPage />
}
