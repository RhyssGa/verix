'use client'

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
  const { deleteHistoryBatch, saveToHistory, saveAgencesToHistory } = useHistory()

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
      <AlertDialog open={!!validateConfirm} onOpenChange={(o) => { if (!o) setValidateConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider et sauvegarder ?</AlertDialogTitle>
            <AlertDialogDescription>
              Sauvegarder l&apos;audit pour{' '}
              <strong>{validateConfirm ? normalizeAgency(validateConfirm) : ''}</strong> dans l&apos;historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-navy text-white hover:bg-navy-light"
              onClick={() => {
                if (score && validateConfirm) {
                  saveToHistory(score, sectionNotes, validateConfirm)
                  setValidateConfirm(null)
                }
              }}
            >
              ✅ Valider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Multi agency validate confirm */}
      <AlertDialog open={!!validateMultiConfirm} onOpenChange={(o) => { if (!o) setValidateMultiConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider {validateMultiConfirm?.length} agences ensemble ?</AlertDialogTitle>
            <AlertDialogDescription>
              {validateMultiConfirm?.map(normalizeAgency).join(' + ')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-navy text-white hover:bg-navy-light"
              onClick={() => {
                if (score && validateMultiConfirm) {
                  saveAgencesToHistory(score, sectionNotes, validateMultiConfirm)
                  setValidateMultiConfirm(null)
                }
              }}
            >
              ✅ Valider
            </AlertDialogAction>
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
