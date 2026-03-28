'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useExport } from '@/hooks/useExport'
import { MiniListItem } from '@/components/cards/MiniListItem'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { eur } from '@/lib/utils/format'

export function DetailModal() {
  const modal = useAuditStore((s) => s.modal)
  const closeModal = useAuditStore((s) => s.closeModal)
  const searchTerm = useAuditStore((s) => s.modalSearchTerm)
  const setSearchTerm = useAuditStore((s) => s.setModalSearchTerm)
  const { exportXlsx } = useExport()

  if (!modal.open) return null

  const { title, categoryId, rows, nameFn, valFn, valClass, subFn, noteColumn } = modal

  const filtered = searchTerm
    ? rows.filter((r) =>
        nameFn(r).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (subFn && subFn(r).toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : rows

  const valFormat = (r: typeof rows[0]) => eur(valFn(r), 2)

  return (
    <Dialog open={modal.open} onOpenChange={(open) => { if (!open) closeModal() }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">{rows.length} ligne(s)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => exportXlsx(
                title.replace(/\s+/g, '_'),
                title,
                categoryId,
                rows,
                nameFn,
                valFn,
                subFn ?? null,
                undefined,
                noteColumn ?? null,
              )}
            >
              ↓ Excel
            </Button>
          </div>
          {rows.length > 10 && (
            <Input
              placeholder="Rechercher…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 text-xs mt-2"
            />
          )}
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-4 py-2">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">Aucun résultat</div>
          ) : (
            filtered.map((row, i) => (
              <MiniListItem
                key={i}
                categoryId={categoryId}
                index={i}
                name={nameFn(row)}
                value={valFormat(row)}
                valueClass={valClass}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
