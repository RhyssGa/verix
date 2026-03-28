import type { FileConfig } from '@/types/audit'

export const GERANCE_FILE_CONFIGS: FileConfig[] = [
  { id: 'z_pointe',      name: 'Garantie / Pointe',              desc: 'Z-GERANCE_POINTE',            icon: '🔐' },
  { id: 'z_mandats',     name: 'Liste mandats',                  desc: 'Z-GERANCE_LISTE_MANDATS',     icon: '📋' },
  { id: 'quittancement', name: 'Quittancement / Encaissement',   desc: 'Detail_Quitt__Encaissements', icon: '💰' },
  { id: 'prop_deb',      name: 'Propriétaires débiteurs',        desc: 'PROPRIETAIRES_DEBITEURS',     icon: '🔴' },
  { id: 'prop_cred',     name: 'Propriétaires créditeurs sortis', desc: 'PROPRIETAIRES_SORTIS_CRED',   icon: '🟡' },
  { id: 'att_deb',       name: 'Attente débiteurs',              desc: 'Cptes_d_attente_deb',         icon: '⏳' },
  { id: 'bq_nonrapp',    name: 'Banque non rapp.',               desc: 'ECR_BANQUES',                 icon: '🏦' },
  { id: 'cpta_nonrapp',  name: 'Compta non rapp.',               desc: 'ECRITURES_COMPTA',            icon: '📒' },
  { id: 'factures',      name: 'Factures',                       desc: 'Factures_Global',             icon: '🧾' },
]

export const COPRO_FILE_CONFIGS: FileConfig[] = [
  { id: 'z_pointe',      name: 'Garantie / Pointe',              desc: 'Z-COPRO_POINTE',                icon: '🔐' },
  { id: 'balance',       name: 'Balance',                        desc: 'VERIFICATION_BALANCE',          icon: '⚖️' },
  { id: 'fourn_deb',     name: 'Fournisseurs débiteurs',         desc: 'DEBITS_FOURNISSEURS',           icon: '🔴' },
  { id: 'att_deb',       name: 'Attente débiteurs',              desc: 'COMPTES_ATTENTES_DIVERS_DEB',   icon: '⏳' },
  { id: 'att_cred',      name: 'Attente créditeurs',             desc: 'Comptes_attente_divers_Cred',   icon: '🟡' },
  { id: 'ventes',        name: 'Ventes non soldées',             desc: 'VENTES_NON_SOLDEES',            icon: '🔄' },
  { id: 'bq_nonrapp',    name: 'Banque non rapp.',               desc: 'COMPTES_ECRITURES_BANQUES',     icon: '🏦' },
  { id: 'cpta_nonrapp',  name: 'Compta non rapp.',               desc: 'ECRITURES_COMPTA_NON_RAPP',     icon: '📒' },
  { id: 'factures',      name: 'Factures',                       desc: 'Factures_Global',               icon: '🧾' },
  { id: 'bilan',         name: 'Bilan / État financier',         desc: 'BILAN_POSITION_MANDATS',        icon: '📊' },
]

export const FILE_MIN_COLS: Record<string, Record<string, number>> = {
  gerance: {
    z_pointe: 8, z_mandats: 9, quittancement: 9, factures: 13,
    prop_deb: 11, prop_cred: 7, att_deb: 9, bq_nonrapp: 16, cpta_nonrapp: 15,
  },
  copro: {
    z_pointe: 8, balance: 8, att_deb: 10, att_cred: 10, ventes: 11,
    fourn_deb: 11, factures: 13, bq_nonrapp: 19, cpta_nonrapp: 14, bilan: 26,
  },
}
