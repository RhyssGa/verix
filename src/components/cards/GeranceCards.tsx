'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScoredGerance, useScore } from '@/stores/computed'
import { useExport } from '@/hooks/useExport'
import { GuaranteeCard } from './GuaranteeCard'
import { QuittancementCard } from './QuittancementCard'
import { DebtorCard } from './DebtorCard'
import { ReconciliationCard } from './ReconciliationCard'
import { NonClosedCard } from './NonClosedCard'
import { InvoicesCard } from './InvoicesCard'
import { excelDateFmt } from '@/lib/utils/format'

export function GeranceCards() {
  const guarantee = useAuditStore((s) => s.guarantee)
  const peak = useAuditStore((s) => s.peak)
  const peakDate = useAuditStore((s) => s.peakDate)
  const endDate = useAuditStore((s) => s.endDate)
  const openModal = useAuditStore((s) => s.openModal)

  const scored = useScoredGerance()
  const score = useScore()

  const {
    quittancement,
    encaissement,
    prop_deb,
    prop_deb_sorti: propSorti = [],
    prop_cred,
    att_deb,
    bq_nonrapp,
    bq_nonclot = [],
    cpta_nonrapp,
    factures,
    factures_nr30,
    factures_nr60,
  } = scored

  const { exportXlsx } = useExport()

  const anomQuitt = score?.anomalies.find((a) => a.id === 'quitt') ?? null
  const anomPropDeb = score?.anomalies.find((a) => a.id === 'propdeb') ?? null
  const anomPropSorti = score?.anomalies.find((a) => a.id === 'propdbsorti') ?? null
  const anomAttDeb = score?.anomalies.find((a) => a.id === 'attdeb') ?? null
  const anomBq = score?.anomalies.find((a) => a.id === 'bq_nonrapp') ?? null
  const anomCpta = score?.anomalies.find((a) => a.id === 'cpta_nonrapp') ?? null

  return (
    <>
      <GuaranteeCard guarantee={guarantee} peak={peak} peakDate={peakDate} />

      <QuittancementCard
        quittancement={quittancement}
        encaissement={encaissement}
        endDate={endDate}
        anomaly={anomQuitt}
      />

      {/* Propriétaires débiteurs ACTIFS */}
      <DebtorCard
        icon="🔴"
        iconColor="bg-status-red-bg"
        label="Propriétaires débiteurs actifs"
        subtitle="Comptes non soldés — en gestion · max −17,5 pts"
        categoryId="propdeb"
        sectionNoteId="propdeb"
        rows={prop_deb}
        nameFn={(r) => String(r[1] || r[0] || '—')}
        amountFn={(r) => Math.abs(parseFloat(String(r[6] ?? 0)) || 0)}
        totalLabel="Total débiteurs"
        countLabel="propriétaire(s)"
        emptyMessage="✓ Aucun propriétaire débiteur actif"
        anomaly={anomPropDeb}
        noteColumn={scored.prop_deb_nc ?? null}
        onViewMore={() =>
          openModal({
            title: 'Propriétaires débiteurs actifs',
            categoryId: 'propdeb',
            rows: prop_deb,
            nameFn: (r) => String(r[1] || r[0] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[6] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: null,
            noteColumn: scored.prop_deb_nc ?? null,
          })
        }
        onExport={() => exportXlsx('prop-debiteurs-actifs', 'Prop. débiteurs actifs', 'propdeb', prop_deb, (r) => String(r[1] || r[0] || '—'), (r) => Math.abs(parseFloat(String(r[6] ?? 0)) || 0), null, [
          { header: 'Propriétaire', fn: (r) => String(r[1] || r[0] || '—') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[6] ?? 0)) || 0)) },
        ], scored.prop_deb_nc ?? null)}
        scoreId="propdeb"
      />

      {/* Propriétaires débiteurs SORTIS */}
      <DebtorCard
        icon="🔴"
        iconColor="bg-status-red-bg"
        label="Propriétaires débiteurs sortis"
        subtitle="Comptes non soldés — sortis de gestion · max −25 pts"
        categoryId="propdbsorti"
        sectionNoteId="propdbsorti"
        rows={propSorti}
        nameFn={(r) => String(r[1] || r[0] || '—')}
        amountFn={(r) => Math.abs(parseFloat(String(r[10] ?? 0)) || 0)}
        totalLabel="Total débiteurs sortis"
        countLabel="propriétaire(s)"
        emptyMessage="✓ Aucun propriétaire sorti débiteur"
        anomaly={anomPropSorti}
        subFn={(r) =>
          r[2] != null ? `Date sortie : ${excelDateFmt(r[2])}` : ''
        }
        onViewMore={() =>
          openModal({
            title: 'Propriétaires débiteurs sortis',
            categoryId: 'propdbsorti',
            rows: propSorti,
            nameFn: (r) => String(r[1] || r[0] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[10] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: (r) =>
              r[2] != null ? `Date sortie : ${excelDateFmt(r[2])}` : '',
          })
        }
        onExport={() => exportXlsx('prop-debiteurs-sortis', 'Prop. débiteurs sortis', 'propdbsorti', propSorti, (r) => String(r[1] || r[0] || '—'), (r) => Math.abs(parseFloat(String(r[10] ?? 0)) || 0), (r) => r[2] != null ? `Date sortie : ${excelDateFmt(r[2])}` : '', [
          { header: 'Propriétaire', fn: (r) => String(r[1] || r[0] || '—') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[10] ?? 0)) || 0)) },
          { header: 'Date sortie', fn: (r) => r[2] != null ? excelDateFmt(r[2]) : '' },
        ])}
        scoreId="propdbsorti"
      />

      {/* Propriétaires créditeurs sortis (info) */}
      <DebtorCard
        icon="ℹ️"
        iconColor="bg-status-info-bg"
        label="Propriétaires créditeurs sortis"
        subtitle="Remboursements à effectuer"
        categoryId="propcred"
        sectionNoteId="propcred"
        rows={prop_cred}
        nameFn={(r) => String(r[1] || r[0] || '—')}
        amountFn={(r) => Math.abs(parseFloat(String(r[6] ?? 0)) || 0)}
        totalLabel="Total à rembourser"
        countLabel="compte(s) créditeur(s)"
        infoOnly
        emptyMessage="Aucun créditeur à signaler"
        subFn={(r) =>
          r[2] != null ? `Date sortie : ${excelDateFmt(r[2])}` : ''
        }
        onViewMore={() =>
          openModal({
            title: 'Propriétaires créditeurs sortis',
            categoryId: 'propcred',
            rows: prop_cred,
            nameFn: (r) => String(r[1] || r[0] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[6] ?? 0)) || 0),
            valClass: 'text-status-info',
            subFn: (r) =>
              r[2] != null ? `Date sortie : ${excelDateFmt(r[2])}` : '',
          })
        }
        onExport={() => exportXlsx('prop-crediteurs-sortis', 'Prop. créditeurs sortis', 'propcred', prop_cred, (r) => String(r[1] || r[0] || '—'), (r) => Math.abs(parseFloat(String(r[6] ?? 0)) || 0), (r) => r[2] != null ? `Date sortie : ${excelDateFmt(r[2])}` : '', [
          { header: 'Propriétaire', fn: (r) => String(r[1] || r[0] || '—') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[6] ?? 0)) || 0)) },
          { header: 'Date sortie', fn: (r) => r[2] != null ? excelDateFmt(r[2]) : '' },
        ])}
        scoreId="propcred"
      />

      {/* Comptes d'attente débiteurs */}
      <DebtorCard
        icon="⏳"
        iconColor="bg-status-orange-bg"
        label="Comptes d'attente débiteurs"
        subtitle="Sauf 475-479-PEC"
        categoryId="attdeb"
        sectionNoteId="attdeb"
        rows={att_deb}
        nameFn={(r) => `${String(r[1] || r[3] || '—')} · ${String(r[6] || '')}`}
        amountFn={(r) => Math.abs(parseFloat(String(r[8] ?? 0)) || 0)}
        totalLabel="Montant total"
        countLabel="compte(s)"
        emptyMessage="✓ Aucun compte d'attente débiteur"
        anomaly={anomAttDeb}
        noteColumn={scored.att_deb_nc ?? null}
        onViewMore={() =>
          openModal({
            title: "Comptes d'attente débiteurs",
            categoryId: 'attdeb',
            rows: att_deb,
            nameFn: (r) =>
              `${String(r[1] || r[3] || '—')} · ${String(r[6] || '')}`,
            valFn: (r) => Math.abs(parseFloat(String(r[8] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: null,
            noteColumn: scored.att_deb_nc ?? null,
          })
        }
        onExport={() => exportXlsx('cptes-attente-deb', "Cptes attente déb.", 'attdeb', att_deb, (r) => `${String(r[1] || r[3] || '—')} · ${String(r[6] || '')}`, (r) => Math.abs(parseFloat(String(r[8] ?? 0)) || 0), null, [
          { header: 'Mandat · Libellé', fn: (r) => (String(r[3] || '—')) + (r[1] ? ' · ' + String(r[1]) : '') },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[8] ?? 0)) || 0)) },
          { header: 'Note Gesteam', fn: (r, nc) => nc != null ? String(r[nc] ?? '') : '' },
        ], scored.att_deb_nc ?? null)}
        scoreId="attdeb"
      />

      <NonClosedCard mode="gerance" rows={bq_nonclot} />

      <ReconciliationCard
        type="bq"
        mode="gerance"
        rows={bq_nonrapp}
        noteColumn={scored.bq_nonrapp_nc ?? null}
        anomaly={anomBq}
        onViewMore={() =>
          openModal({
            title: 'Banque non rapprochée',
            categoryId: 'bqrapp',
            rows: bq_nonrapp,
            nameFn: (r) => String(r[7] || r[0] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[15] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[14] ? excelDateFmt(r[14]) : '',
              ]
                .filter(Boolean)
                .join(' · '),
          })
        }
        onExport={() => exportXlsx('bq-nonrapp', 'Banque non rapprochée', 'bqrapp', bq_nonrapp, (r) => String(r[7] || r[0] || '—'), (r) => Math.abs(parseFloat(String(r[15] ?? 0)) || 0), (r) => r[14] ? excelDateFmt(r[14]) : '', [
          { header: 'Banque · Date · Libellé', fn: (r) => `${String(r[0] || '')} · ${excelDateFmt(r[14])} · ${String(r[7] || '—')}` },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[15] ?? 0)) || 0)) },
        ])}
      />

      <ReconciliationCard
        type="cpta"
        mode="gerance"
        rows={cpta_nonrapp}
        noteColumn={scored.cpta_nonrapp_nc ?? null}
        anomaly={anomCpta}
        onViewMore={() =>
          openModal({
            title: 'Compta non rapprochée',
            categoryId: 'cptarapp',
            rows: cpta_nonrapp,
            nameFn: (r) => String(r[14] || r[6] || '—'),
            valFn: (r) => Math.abs(parseFloat(String(r[13] ?? 0)) || 0),
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[12] ? excelDateFmt(r[12]) : '',
                r[15] != null ? `${r[15]} j` : '',
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.cpta_nonrapp_nc ?? null,
          })
        }
        onExport={() => exportXlsx('cpta-nonrapp', 'Compta non rapprochée', 'cptarapp', cpta_nonrapp, (r) => String(r[14] || r[6] || '—'), (r) => Math.abs(parseFloat(String(r[13] ?? 0)) || 0), (r) => [r[12] ? excelDateFmt(r[12]) : '', r[15] != null ? `${r[15]} j` : ''].filter(Boolean).join(' · '), [
          { header: 'Banque · Date · Libellé', fn: (r) => `${String(r[6] || '')} · ${excelDateFmt(r[12])} · ${String(r[14] || '—')}` },
          { header: 'Montant', fn: (r) => String(Math.abs(parseFloat(String(r[13] ?? 0)) || 0)) },
        ], scored.cpta_nonrapp_nc ?? null)}
      />

      <InvoicesCard
        mode="gerance"
        factures_nr30={factures_nr30}
        factures_nr60={factures_nr60}
        totalCount={factures.length}
        endDate={endDate}
        onViewMore={() =>
          openModal({
            title: 'Factures non réglées +60j',
            categoryId: 'fact60',
            rows: factures_nr60,
            nameFn: (r) => String(r[4] || '—'),
            valFn: (r) => parseFloat(String(r[10] ?? 0)) || 0,
            valClass: 'text-status-red',
            subFn: (r) =>
              [
                r[5] ? excelDateFmt(r[5]) : '',
                String(r[8] || ''),
                String(r[9] || ''),
                r[7] != null ? `${r[7]} j` : '',
                String(r[11] || ''),
              ]
                .filter(Boolean)
                .join(' · '),
            noteColumn: scored.factures_nc ?? null,
          })
        }
        onExport={() => exportXlsx('factures-nr60', 'Factures +60j', 'fact60', factures_nr60, (r) => String(r[4] || '—'), (r) => parseFloat(String(r[10] ?? 0)) || 0, (r) => [r[5] ? excelDateFmt(r[5]) : '', String(r[8] || ''), String(r[9] || ''), r[7] != null ? `${r[7]} j` : '', String(r[11] || '')].filter(Boolean).join(' · '), [
          { header: 'Mandat · Date · Entreprise · Libellé', fn: (r) => `${String(r[4] || '—')} · ${excelDateFmt(r[5])} · ${String(r[8] || '—')} · ${String(r[9] || '—')}` },
          { header: 'Montant', fn: (r) => String(parseFloat(String(r[10] ?? 0)) || 0) },
          { header: 'Ancienneté · Note Gesteam', fn: (r, nc) => { const age = r[7] != null ? `${r[7]} j` : ''; const note = nc != null ? String(r[nc] ?? '') : ''; return age && note ? `${age} · ${note}` : age || note } },
        ], scored.factures_nc ?? null)}
      />
    </>
  )
}
