'use client'

import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ok:   { bg: 'bg-status-green-bg', text: 'text-status-green', label: '✓ OK' },
  warn: { bg: 'bg-status-orange-bg', text: 'text-status-orange', label: '⚠ Attention' },
  bad:  { bg: 'bg-status-red-bg', text: 'text-status-red', label: '✗ Anomalie' },
  info: { bg: 'bg-status-info-bg', text: 'text-status-info', label: 'ℹ Info' },
}

interface StatusBadgeProps {
  level: string
  className?: string
}

export function StatusBadge({ level, className }: StatusBadgeProps) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.info
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
        style.bg,
        style.text,
        className,
      )}
    >
      {style.label}
    </span>
  )
}
