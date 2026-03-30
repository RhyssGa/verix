'use client'

import { useState } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { useHistory } from '@/hooks/useHistory'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { normalizeAgency } from '@/lib/utils/helpers'

export function ConfirmDialog() {
  const deleteConfirm = useAuditStore((s) => s.deleteConfirm)
  const validateConfirm = useAuditStore((s) => s.validateConfirm)
  const validateMultiConfirm = useAuditStore((s) => s.validateMultiConfirm)
  const resetConfirm = useAuditStore((s) => s.resetConfirm)
  const setDeleteConfirm = useAuditStore((s) => s.setDeleteConfirm)
  const setValidateConfirm = useAuditStore((s) => s.setValidateConfirm)
  const setValidateMultiConfirm = useAuditStore((s) => s.setValidateMultiConfirm)
  const setResetConfirm = useAuditStore((s) => s.setResetConfirm)
  const resetAll = useAuditStore((s) => s.resetAll)
  const sectionNotes = useAuditStore((s) => s.sectionNotes)
  const score = useScore()
  const { deleteHistoryBatch, saveAgencesToHistory } = useHistory()

  const [isSaving, setIsSaving] = useState(false)

  return (
    <>
      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le rapport et son snapshot seront supprimés.
              {deleteConfirm && deleteConfirm.count > 1 && ` (${deleteConfirm.count} entrées)`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-red text-white hover:bg-status-red/90"
              onClick={() => deleteConfirm && deleteHistoryBatch(deleteConfirm.batchId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single agency validate confirm */}
      <AlertDialog open={!!validateConfirm} onOpenChange={(o) => { if (!o && !isSaving) setValidateConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider et sauvegarder ?</AlertDialogTitle>
            <AlertDialogDescription>
              Sauvegarder l&apos;audit pour{' '}
              <strong>{validateConfirm ? normalizeAgency(validateConfirm) : ''}</strong> dans l&apos;historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Annuler</AlertDialogCancel>
            <button
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0B1929] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A3252] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              onClick={async () => {
                if (!score || !validateConfirm) return
                setIsSaving(true)
                await saveAgencesToHistory(score, sectionNotes, [validateConfirm])
                setIsSaving(false)
                setValidateConfirm(null)
              }}
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sauvegarde…
                </>
              ) : '✅ Valider'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Multi agency validate confirm */}
      <AlertDialog open={!!validateMultiConfirm} onOpenChange={(o) => { if (!o && !isSaving) setValidateMultiConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider {validateMultiConfirm?.length} agences ensemble ?</AlertDialogTitle>
            <AlertDialogDescription>
              {validateMultiConfirm?.map(normalizeAgency).join(' + ')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Annuler</AlertDialogCancel>
            <button
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0B1929] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A3252] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              onClick={async () => {
                if (!score || !validateMultiConfirm) return
                setIsSaving(true)
                await saveAgencesToHistory(score, sectionNotes, validateMultiConfirm)
                setIsSaving(false)
                setValidateMultiConfirm(null)
              }}
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sauvegarde…
                </>
              ) : '✅ Valider'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Reset confirm */}
      <AlertDialog open={resetConfirm} onOpenChange={(o) => { if (!o) setResetConfirm(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser toutes les données ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les fichiers importés, annotations et paramètres seront effacés.
              L&apos;historique des audits sauvegardés est conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-red text-white hover:bg-status-red/90"
              onClick={() => { resetAll(); setResetConfirm(false) }}
            >
              ↺ Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
