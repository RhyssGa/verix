'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScoredCopro, useScore } from '@/stores/computed'
import { useExport } from '@/hooks/useExport'
import { GuaranteeCard } from './GuaranteeCard'
import { BalanceCard } from './BalanceCard'
import { DebtorCard } from './DebtorCard'
import { ReconciliationCard } from './ReconciliationCard'
import { NonClosedCard } from './NonClosedCard'
import { InvoicesCard } from './InvoicesCard'
import { FinancialStateCard } from './FinancialStateCard'
import { excelDateFmt } from '@/lib/utils/format'

export function CoproCards() {
  const guarantee = useAuditStore((s) => s.guarantee)
  const peak = useAuditStore((s) => s.peak)
  const peakDate = useAuditStore((s) => s.peakDate)
  const endDate = useAuditStore((s) => s.endDate)
  const openModal = useAuditStore((s) => s.openModal)
  const openFinancialStateModal = useAuditStore((s) => s.openFinancialStateModal)

  const scored = useScoredCopro()
  const score = useScore()

  const {
    balance_bad,
    att_deb,
    att_cred,
    ventes_deb,
    ventes_cred,
    fourn_deb,
    bq_nonrapp,
    bq_nonclot = [],
    cpta_nonrapp,
    factures,
    factures_nr30,
    factures_nr60,
    bilan = [],
  } = scored

  const { exportXlsx } = useExport()

  const anomBalance = score?.anomalies.find((a) => a.id === 'balance') ?? null
  const anomFournDeb = score?.anomalies.find((a) => a.id === 'fourndeb') ?? null
  const anomAttDeb = score?.anomalies.find((a) => a.id === 'cattdeb') ?? null
  const anomVentesDeb = score?.anomalies.find((a) => a.id === 'ventesdeb') ?? null
  const anomBq = score?.anomalies.find((a) => a.id === 'bq_nonrapp') ?? null
  const anomCpta = score?.anomalies.find((a) => a.id === 'cpta_nonrapp') ?? null

  return (
    <>
      <GuaranteeCard guarantee={guarantee} peak={peak} peakDate={peakDate} />

      <BalanceCard
        rows={balance_bad}
        anomaly={anomBalance}
        onViewMore={() =>
          openModal({
            title: 'Balances déséquilibrées',
            categoryId: 'balance',
            rows: balance_bad,
            nameFn: (r) => String(r[3] || r[1] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[7] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: null,
          })
        }
        onExport={() => exportXlsx('balances-desequilibrees', 'Balances déséquilibrées', 'balance', balance_bad, (r) => String(r[3] || r[1] || '—'), (r) => Math.abs(parseFloat(String(r[7] ?? 0)) || 0), null, [
          { header: 'Libellé', fn: (r) => String(r[3] || r[1] || '—') },
          { header: 'Écart', fn: (r) => String(Math.abs(parseFloat(String(r[7] ?? 0)) || 0)) },
        ])}
      />

      {/* Fournisseurs débiteurs */}
      <DebtorCard
        icon="🔴"
        iconColor="bg-status-red-bg"
        label="Fournisseurs débiteurs"
        subtitle="Comptes fournisseurs à solde débiteur"
        categoryId="fourndeb"
        sectionNoteId="fourndeb"
        rows={fourn_deb}
        nameFn={(r) => `${String(r[7] || '—')} · ${String(r[8] || '')}`}
        amountFn={(r) => parseFloat(String(r[10] ?? 0)) || 0}
        totalLabel="Montant total"
        countLabel="compte(s)"
        emptyMessage="✓ Aucun fournisseur débiteur"
        anomaly={anomFournDeb}
        noteColumn={scored.fourn_deb_nc ?? null}
        subFn={(r) =>
          [
            String(r[1] || ''),
            scored.fourn_deb_nc != null && r[scored.fourn_deb_nc]
              ? `Note : ${String(r[scored.fourn_deb_nc])}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        }
        onViewMore={() =>
          openModal({
            title: 'Fournisseurs débiteurs',
            categoryId: 'fourndeb',
            rows: fourn_deb,
            nameFn: (r) => `${String(r[7] || '—')} · ${String(r[8] || '')}`,
            valFn: (r) => parseFloat(String(r[10] ?? 0)) || 0,
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                String(r[1] || ''),
                scored.fourn_deb_nc != null && r[scored.fourn_deb_nc]
                  ? `Note : ${String(r[scored.fourn_deb_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.fourn_deb_nc ?? null,
          })
        }
        onExport={() => exportXlsx('fourn-debiteurs', 'Fournisseurs débiteurs', 'fourndeb', fourn_deb, (r) => `${String(r[7] || '—')} · ${String(r[8] || '')}`, (r) => parseFloat(String(r[10] ?? 0)) || 0, (r) => String(r[1] || ''), [
          { header: 'Résidence · Fournisseur', fn: (r) => String(r[1] || '') + ' · ' + (String(r[7] || '—')) + (r[8] ? ' · ' + String(r[8]) : '') },
          { header: 'Montant', fn: (r) => String(parseFloat(String(r[10] ?? 0)) || 0) },
          { header: 'Note Gesteam', fn: (r, nc) => nc != null ? String(r[nc] ?? '') : '' },
        ], scored.fourn_deb_nc ?? null)}
        scoreId="fourndeb"
      />

      {/* Comptes d'attente débiteurs */}
      <DebtorCard
        icon="⏳"
        iconColor="bg-status-orange-bg"
        label="Comptes d'attente débiteurs"
        subtitle="46/47/48/49 — solde débiteur"
        categoryId="cattdeb"
        sectionNoteId="cattdeb"
        rows={att_deb}
        nameFn={(r) => `${String(r[6] || '—')} · ${String(r[5] || '')}`}
        amountFn={(r) => Math.abs(parseFloat(String(r[9] ?? 0)) || 0)}
        totalLabel="Montant total"
        countLabel="compte(s)"
        emptyMessage="✓ Aucun"
        anomaly={anomAttDeb}
        noteColumn={scored.att_deb_nc ?? null}
        subFn={(r) =>
          [
            String(r[1] || ''),
            scored.att_deb_nc != null && r[scored.att_deb_nc]
              ? `Note : ${String(r[scored.att_deb_nc])}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        }
        onViewMore={() =>
          openModal({
            title: "Comptes d'attente débiteurs",
            categoryId: 'cattdeb',
            rows: att_deb,
            nameFn: (r) => `${String(r[6] || '—')} · ${String(r[5] || '')}`,
            valFn: (r) => Math.abs(parseFloat(String(r[9] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                String(r[1] || ''),
                scored.att_deb_nc != null && r[scored.att_deb_nc]
                  ? `Note : ${String(r[scored.att_deb_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.att_deb_nc ?? null,
          })
        }
        onExport={() => exportXlsx('cptes-attente-deb', "Cptes attente déb.", 'cattdeb', att_deb, (r) => `${String(r[6] || '—')} · ${String(r[5] || '')}`, (r) => Math.abs(parseFloat(String(r[9] ?? 0)) || 0), (r) => String(r[1] || ''), [
          { header: 'Résidence · Libellé', fn: (r) => String(r[1] || '') + ' · ' + (String(r[6] || '—')) + (r[5] ? ' · ' + String(r[5]) : '') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[9] ?? 0)) || 0)) },
          { header: 'Note Gesteam', fn: (r, nc) => nc != null ? String(r[nc] ?? '') : '' },
        ], scored.att_deb_nc ?? null)}
        scoreId="cattdeb"
      />

      {/* Comptes d'attente créditeurs (info) */}
      <DebtorCard
        icon="ℹ️"
        iconColor="bg-status-info-bg"
        label="Comptes d'attente créditeurs"
        subtitle="46/47/48/49 — info uniquement"
        categoryId="cattcred"
        sectionNoteId="cattcred"
        rows={att_cred}
        nameFn={(r) => `${String(r[6] || '—')} · ${String(r[5] || '')}`}
        amountFn={(r) => Math.abs(parseFloat(String(r[9] ?? 0)) || 0)}
        totalLabel="Montant total"
        countLabel="compte(s)"
        infoOnly
        emptyMessage="Aucun"
        noteColumn={scored.att_cred_nc ?? null}
        subFn={(r) =>
          [
            String(r[1] || ''),
            scored.att_cred_nc != null && r[scored.att_cred_nc]
              ? `Note : ${String(r[scored.att_cred_nc])}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        }
        onViewMore={() =>
          openModal({
            title: "Comptes d'attente créditeurs",
            categoryId: 'cattcred',
            rows: att_cred,
            nameFn: (r) => `${String(r[6] || '—')} · ${String(r[5] || '')}`,
            valFn: (r) => Math.abs(parseFloat(String(r[9] ?? 0)) || 0),
            valClass: 'text-status-info',
            subFn: (r) =>
              [
                String(r[1] || ''),
                scored.att_cred_nc != null && r[scored.att_cred_nc]
                  ? `Note : ${String(r[scored.att_cred_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.att_cred_nc ?? null,
          })
        }
        onExport={() => exportXlsx('cptes-attente-cred', "Cptes attente créd.", 'cattcred', att_cred, (r) => `${String(r[6] || '—')} · ${String(r[5] || '')}`, (r) => Math.abs(parseFloat(String(r[9] ?? 0)) || 0), (r) => String(r[1] || ''), [
          { header: 'Résidence · Libellé', fn: (r) => String(r[1] || '') + ' · ' + (String(r[6] || '—')) + (r[5] ? ' · ' + String(r[5]) : '') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[9] ?? 0)) || 0)) },
          { header: 'Note Gesteam', fn: (r, nc) => nc != null ? String(r[nc] ?? '') : '' },
        ], scored.att_cred_nc ?? null)}
        scoreId="cattcred"
      />

      {/* Copropriétaires sortis débiteurs */}
      <DebtorCard
        icon="📤"
        iconColor="bg-status-red-bg"
        label="Copropriétaires sortis débiteurs"
        subtitle="Ventes non soldées — solde positif"
        categoryId="ventesdeb"
        sectionNoteId="ventesdeb"
        rows={ventes_deb}
        nameFn={(r) => `${String(r[1] || '—')} · ${String(r[7] || '')}`}
        amountFn={(r) => parseFloat(String(r[10] ?? 0)) || 0}
        totalLabel="Total débiteur"
        countLabel="compte(s)"
        emptyMessage="✓ Aucun"
        anomaly={anomVentesDeb}
        noteColumn={scored.ventes_nc ?? null}
        subFn={(r) =>
          [
            r[8] ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}` : '',
            r[9] != null ? `${r[9]} j` : '',
            scored.ventes_nc != null && r[scored.ventes_nc]
              ? `Note : ${String(r[scored.ventes_nc])}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        }
        onViewMore={() =>
          openModal({
            title: 'Copropriétaires sortis débiteurs',
            categoryId: 'ventesdeb',
            rows: ventes_deb,
            nameFn: (r) => `${String(r[1] || '—')} · ${String(r[7] || '')}`,
            valFn: (r) => parseFloat(String(r[10] ?? 0)) || 0,
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[8]
                  ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}`
                  : '',
                r[9] != null ? `${r[9]} j` : '',
                scored.ventes_nc != null && r[scored.ventes_nc]
                  ? `Note : ${String(r[scored.ventes_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.ventes_nc ?? null,
          })
        }
        onExport={() => exportXlsx('copro-sortis-deb', 'Copro. sortis débiteurs', 'ventesdeb', ventes_deb, (r) => `${String(r[1] || '—')} · ${String(r[7] || '')}`, (r) => parseFloat(String(r[10] ?? 0)) || 0, (r) => [r[8] ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}` : '', r[9] != null ? `${r[9]} j` : ''].filter(Boolean).join(' · '), [
          { header: 'Résidence · Copropriétaire', fn: (r) => String(r[1] || '—') + ' · ' + String(r[7] || '') },
          { header: 'Montant', fn: (r) => String(parseFloat(String(r[10] ?? 0)) || 0) },
          { header: 'Ancienneté', fn: (r) => r[9] != null ? `${r[9]} j` : '' },
        ], scored.ventes_nc ?? null)}
        scoreId="ventesdeb"
      />

      {/* Copropriétaires sortis créditeurs (info) */}
      <DebtorCard
        icon="📥"
        iconColor="bg-status-info-bg"
        label="Copropriétaires sortis créditeurs"
        subtitle="Ventes non soldées — solde négatif · info"
        categoryId="ventescred"
        sectionNoteId="ventescred"
        rows={ventes_cred}
        nameFn={(r) => `${String(r[1] || '—')} · ${String(r[7] || '')}`}
        amountFn={(r) => Math.abs(parseFloat(String(r[10] ?? 0)) || 0)}
        totalLabel="Total à rembourser"
        countLabel="compte(s)"
        infoOnly
        emptyMessage="Aucun"
        noteColumn={scored.ventes_nc ?? null}
        subFn={(r) =>
          [
            r[8]
              ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}`
              : '',
            r[9] != null ? `${r[9]} j` : '',
            scored.ventes_nc != null && r[scored.ventes_nc]
              ? `Note : ${String(r[scored.ventes_nc])}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        }
        onViewMore={() =>
          openModal({
            title: 'Copropriétaires sortis créditeurs',
            categoryId: 'ventescred',
            rows: ventes_cred,
            nameFn: (r) => `${String(r[1] || '—')} · ${String(r[7] || '')}`,
            valFn: (r) => Math.abs(parseFloat(String(r[10] ?? 0)) || 0),
            valClass: 'text-status-info',
            subFn: (r) =>
              [
                r[8]
                  ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}`
                  : '',
                r[9] != null ? `${r[9]} j` : '',
                scored.ventes_nc != null && r[scored.ventes_nc]
                  ? `Note : ${String(r[scored.ventes_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.ventes_nc ?? null,
          })
        }
        onExport={() => exportXlsx('copro-sortis-cred', 'Copro. sortis créditeurs', 'ventescred', ventes_cred, (r) => `${String(r[1] || '—')} · ${String(r[7] || '')}`, (r) => Math.abs(parseFloat(String(r[10] ?? 0)) || 0), (r) => [r[8] ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}` : '', r[9] != null ? `${r[9]} j` : ''].filter(Boolean).join(' · '), [
          { header: 'Résidence · Copropriétaire', fn: (r) => String(r[1] || '—') + ' · ' + String(r[7] || '') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[10] ?? 0)) || 0)) },
          { header: 'Ancienneté', fn: (r) => r[9] != null ? `${r[9]} j` : '' },
        ], scored.ventes_nc ?? null)}
        scoreId="ventescred"
      />

      <NonClosedCard mode="copro" rows={bq_nonclot} />

      <ReconciliationCard
        type="bq"
        mode="copro"
        rows={bq_nonrapp}
        noteColumn={scored.bq_nonrapp_nc ?? null}
        anomaly={anomBq}
        onViewMore={() =>
          openModal({
            title: 'Banque non rapprochée',
            categoryId: 'bqrapp',
            rows: bq_nonrapp,
            nameFn: (r) => String(r[19] || r[0] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[18] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[15] ? excelDateFmt(r[15]) : '',
                r[2] ? String(r[2]) : '',
                scored.bq_nonrapp_nc != null && r[scored.bq_nonrapp_nc]
                  ? `Note : ${String(r[scored.bq_nonrapp_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
          })
        }
        onExport={() => exportXlsx('bq-nonrapp', 'Banque non rapprochée', 'bqrapp', bq_nonrapp, (r) => String(r[19] || r[0] || '—'), (r) => Math.abs(parseFloat(String(r[18] ?? 0)) || 0), (r) => [r[15] ? excelDateFmt(r[15]) : '', r[2] ? String(r[2]) : ''].filter(Boolean).join(' · '), [
          { header: 'Résidence · Date · Libellé', fn: (r) => `${String(r[2] || '')} · ${excelDateFmt(r[15])} · ${String(r[19] || '—')}` },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[18] ?? 0)) || 0)) },
          { header: 'Ancienneté', fn: (r) => r[12] != null ? `${r[12]} j` : '' },
        ])}
      />

      <ReconciliationCard
        type="cpta"
        mode="copro"
        rows={cpta_nonrapp}
        noteColumn={scored.cpta_nonrapp_nc ?? null}
        anomaly={anomCpta}
        onViewMore={() =>
          openModal({
            title: 'Compta non rapprochée',
            categoryId: 'cptarapp',
            rows: cpta_nonrapp,
            nameFn: (r) => String(r[14] || r[0] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[13] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[10] ? excelDateFmt(r[10]) : '',
                r[1] ? String(r[1]) : '',
                r[11] != null ? `${r[11]} j` : '',
                scored.cpta_nonrapp_nc != null && r[scored.cpta_nonrapp_nc]
                  ? `Note : ${String(r[scored.cpta_nonrapp_nc])}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.cpta_nonrapp_nc ?? null,
          })
        }
        onExport={() => exportXlsx('cpta-nonrapp', 'Compta non rapprochée', 'cptarapp', cpta_nonrapp, (r) => String(r[14] || r[0] || '—'), (r) => Math.abs(parseFloat(String(r[13] ?? 0)) || 0), (r) => [r[10] ? excelDateFmt(r[10]) : '', r[1] ? String(r[1]) : '', r[11] != null ? `${r[11]} j` : ''].filter(Boolean).join(' · '), [
          { header: 'Résidence · Date · Libellé', fn: (r) => `${String(r[1] || '')} · ${excelDateFmt(r[10])} · ${String(r[14] || '—')}` },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[13] ?? 0)) || 0)) },
        ], scored.cpta_nonrapp_nc ?? null)}
      />

      <InvoicesCard
        mode="copro"
        factures_nr30={factures_nr30}
        factures_nr60={factures_nr60}
        totalCount={factures.length}
        endDate={endDate}
        onViewMore={() =>
          openModal({
            title: 'Factures non réglées +60j',
            categoryId: 'fact60',
            rows: factures_nr60,
            nameFn: (r) => String(r[7] || '—'),
            valFn: (r) => parseFloat(String(r[11] ?? 0)) || 0,
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[4] ? excelDateFmt(r[4]) : '',
                String(r[8] || ''),
                String(r[9] || ''),
                r[6] != null ? `${r[6]} j` : '',
                String(r[10] || ''),
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.factures_nc ?? null,
          })
        }
        onExport={() => exportXlsx('factures-nr60', 'Factures +60j', 'fact60', factures_nr60, (r) => String(r[7] || '—'), (r) => parseFloat(String(r[11] ?? 0)) || 0, (r) => [r[4] ? excelDateFmt(r[4]) : '', String(r[8] || ''), String(r[9] || ''), r[6] != null ? `${r[6]} j` : '', String(r[10] || '')].filter(Boolean).join(' · '), [
          { header: 'Résidence · Date · Entreprise · Libellé', fn: (r) => `${String(r[7] || '—')} · ${excelDateFmt(r[4])} · ${String(r[8] || '—')} · ${String(r[9] || '—')}` },
          { header: 'Montant', fn: (r) => String(parseFloat(String(r[11] ?? 0)) || 0) },
          { header: 'Ancienneté · Note Gesteam', fn: (r, nc) => { const age = r[6] != null ? `${r[6]} j` : ''; const note = nc != null ? String(r[nc] ?? '') : ''; return age && note ? `${age} · ${note}` : age || note } },
        ], scored.factures_nc ?? null)}
      />

      <FinancialStateCard
        bilan={bilan}
        onOpenGroup={(title, rows) => openFinancialStateModal(title, rows)}
      />
    </>
  )
}
