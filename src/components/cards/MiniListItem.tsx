'use client'

import { useState } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { getAnnotation, buildAnnotationKey } from '@/lib/utils/helpers'
import { INFO_CATEGORY_IDS } from '@/constants/infoCids'
import { truncate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

interface MiniListItemProps {
  categoryId: string
  index: number
  name: string
  value: string
  valueClass?: string
  sub?: string
}

export function MiniListItem({
  categoryId,
  index,
  name,
  value,
  valueClass = '',
  sub,
}: MiniListItemProps) {
  const annotations = useAuditStore((s) => s.annotations)
  const toggleInclude = useAuditStore((s) => s.toggleInclude)
  const saveComment = useAuditStore((s) => s.saveComment)
  const [commentOpen, setCommentOpen] = useState(false)

  const annotation = getAnnotation(annotations, categoryId, index)
  const key = buildAnnotationKey(categoryId, index)
  const isExcluded = !annotation.include
  const hasComment = !!annotation.comment
  const isInfoOnly = INFO_CATEGORY_IDS.has(categoryId)
  const displayName = name?.trim() && name !== '—' ? name : `Ligne ${index + 1}`

  return (
    <div className="py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex-1 text-[13px] font-medium truncate',
            isExcluded && 'line-through text-muted-foreground',
          )}
          title={displayName}
        >
          {truncate(displayName, 40)}
        </span>
        <span
          className={cn(
            'text-[13px] font-bold whitespace-nowrap flex-shrink-0',
            isExcluded && 'line-through text-muted-foreground',
            !isExcluded && valueClass,
          )}
        >
          {value}
        </span>
        {!isInfoOnly && (
          <button
            className={cn(
              'w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border transition-colors',
              annotation.include
                ? 'border-status-red text-status-red hover:bg-status-red-bg'
                : 'border-status-green text-status-green bg-status-green-bg',
            )}
            onClick={() => toggleInclude(categoryId, index)}
            title={annotation.include ? 'Marquer comme Justifié' : 'Marquer comme Injustifié'}
          >
            {annotation.include ? '✗' : '✓'}
          </button>
        )}
        <button
          className={cn(
            'text-xs transition-opacity',
            hasComment || commentOpen ? 'opacity-100' : 'opacity-40 hover:opacity-70',
          )}
          onClick={() => setCommentOpen(!commentOpen)}
          title="Commentaire"
        >
          💬
        </button>
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</div>
      )}
      {(commentOpen || hasComment) && (
        <div className="mt-1.5">
          <Textarea
            rows={1}
            placeholder="Commentaire…"
            defaultValue={annotation.comment}
            onBlur={(e) => saveComment(categoryId, index, e.target.value)}
            className="text-[11px] resize-none h-7 min-h-[28px] py-1 px-2"
          />
        </div>
      )}
    </div>
  )
}
