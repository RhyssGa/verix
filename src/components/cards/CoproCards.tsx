'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScoredCopro, useScore } from '@/stores/computed'
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
      />

      <FinancialStateCard
        bilan={bilan}
        onOpenGroup={(title, rows) => openFinancialStateModal(title, rows)}
      />
    </>
  )
}
