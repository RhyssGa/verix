import type { GeranceData, CoproData } from '@/types/audit'

export const EMPTY_GERANCE: GeranceData = {
  quittancement: 0,
  encaissement: 0,
  quittancement_rows: [],
  att_deb: [],
  prop_deb: [],
  prop_deb_sorti: [],
  prop_cred: [],
  bq_nonrapp: [],
  bq_nonclot: [],
  cpta_nonrapp: [],
  factures: [],
  factures_nr30: [],
  factures_nr60: [],
}

export const EMPTY_COPRO: CoproData = {
  balance_bad: [],
  att_deb: [],
  att_cred: [],
  ventes_deb: [],
  ventes_cred: [],
  fourn_deb: [],
  bq_nonrapp: [],
  bq_nonclot: [],
  cpta_nonrapp: [],
  factures: [],
  factures_nr30: [],
  factures_nr60: [],
  bilan: [],
}
