# CLAUDE.md — Audit Comptable Century 21

## Vue d'ensemble

Outil d'audit comptable pour agences Century 21. Analyse les exports Power BI de deux activités : **Gérance** et **Copropriété**. L'auditeur importe des fichiers Excel, visualise les anomalies, annote/exclut des lignes, et génère un rapport **PDF**.

L'application est **entièrement opérationnelle** en Next.js 14.

---

## ⚠️ Évolution prévue — Migration BDD (à faire)

**Toutes les données de sauvegarde doivent migrer vers Supabase, stockées par agence.**

Situation actuelle : les snapshots complets (ExcelRow[], annotations, notes) sont écrits dans `localStorage` sous `c21_audit_snap_<id>`. Cette solution est fragile :
- Limite ~5–10 Mo selon le navigateur → écriture silencieusement échouée si plein
- Le navigateur peut vider le localStorage (mode privé, nettoyage)
- `hasSnapshot: false` = données définitivement perdues

**Cible :**
- Table `audit_snapshots` dans Supabase avec une colonne JSONB pour le snapshot
- L'index léger (`reportHistory`) peut rester en localStorage
- Routes `/api/audits` et `/api/audits/:id` déjà partiellement en place
- Données organisées par agence (clé = `normalizeAgence(agence)` + `mode`)

**Ne pas coder avant validation explicite.**

---

## Architecture

### Tech Stack
- **Next.js 14** App Router, TypeScript strict
- **Prisma ORM** + **Supabase** (PostgreSQL) — optionnel, fonctionne sans base
- **CSS global** (`globals.css`) — pas de Tailwind
- **xlsx** — parsing ET export Excel côté client
- **puppeteer** v24 — génération PDF côté serveur (`/api/rapport/pdf`)

### Lancer le dev
```bash
cd "/Users/rhyssgauthier/Library/Mobile Documents/com~apple~CloudDocs/AUTOMATISATION AUDIT/audit-app"
npm run dev
```

---

## Les deux modes d'audit

### Mode Gérance (9 fichiers — dont 2 "Z" spéciaux)

| Clé interne     | Export Power BI attendu       | Rôle |
|-----------------|-------------------------------|------|
| `z_pointe`      | Z-GERANCE_POINTE              | Auto-remplit garantie, pointe, agences |
| `z_mandats`     | Z-GERANCE_LISTE_MANDATS       | Auto-remplit nbMandats |
| `quittancement` | Detail_Quitt__Encaissements   | |
| `factures`      | Factures_Global               | |
| `prop_deb`      | PROPRIETAIRES_DEBITEURS       | |
| `prop_cred`     | PROPRIETAIRES_SORTIS_CRED     | Info seulement |
| `att_deb`       | Cptes_d_attente_deb           | |
| `bq_nonrapp`    | ECR_BANQUES                   | |
| `cpta_nonrapp`  | ECRITURES_COMPTA              | |

### Mode Copropriété (10 fichiers — dont 1 "Z" spécial)

| Clé interne     | Export Power BI attendu       | Rôle |
|-----------------|-------------------------------|------|
| `z_pointe`      | Z-COPRO_POINTE                | Auto-remplit garantie, pointe, agences |
| `balance`       | VERIFICATION_BALANCE          | |
| `att_deb`       | COMPTES_ATTENTES_DIVERS_DEB   | |
| `att_cred`      | Comptes_attente_divers_Cred   | Info seulement |
| `ventes`        | VENTES_NON_SOLDEES            | |
| `fourn_deb`     | DEBITS_FOURNISSEURS           | |
| `factures`      | Factures_Global               | |
| `bq_nonrapp`    | COMPTES_ECRITURES_BANQUES     | |
| `cpta_nonrapp`  | ECRITURES_COMPTA_NON_RAPP     | |
| `bilan`         | BILAN_POSITION_MANDATS        | Source de nbCopro |

---

## Validation des fichiers importés

`FILE_MIN_COLS` dans `AuditClient.tsx` — nombre min de colonnes attendu par fichier :
```typescript
const FILE_MIN_COLS = {
  gerance: { z_pointe: 8, z_mandats: 9, quittancement: 9, factures: 13,
             prop_deb: 11, prop_cred: 7, att_deb: 9, bq_nonrapp: 16, cpta_nonrapp: 15 },
  copro:   { z_pointe: 8, balance: 8, att_deb: 10, att_cred: 10, ventes: 11,
             fourn_deb: 11, factures: 13, bq_nonrapp: 19, cpta_nonrapp: 14, bilan: 26 },
}
```
On prend le max de colonnes parmi les 5 premières lignes (pour les fichiers Z dont la ligne 1 est vide).

---

## Indices colonnes par fichier (référence complète)

### Factures_Global — colonnes communes aux 2 modes (0-indexé)
Les fichiers gérance et copro ont des structures différentes :

| Champ | Gérance (col) | Copro (col) |
|-------|--------------|-------------|
| Identifiant agence (filtre) | B = 1 | B = 1 |
| Résidence / Mandat | E = 4 | H = 7 |
| Date facture | F = 5 | E = 4 |
| Ancienneté (Nb jours) | H = 7 | G = 6 |
| Entreprise | I = 8 | I = 8 |
| Libellé | J = 9 | J = 9 |
| Note Gesteam | L = 11 | K = 10 |
| Montant TTC | K = 10 | L = 11 |
| Statut (filtre "réglée") | M = 12 | M = 12 |

### Rapprochements — colonnes clés
| Fichier | Colonne montant | Colonne nb jours |
|---------|----------------|-----------------|
| Gérance bq_nonrapp | P = 15 | — |
| Gérance cpta_nonrapp | N = 13 | P = 15 |
| Copro bq_nonrapp | S = 18 | M = 12 |
| Copro cpta_nonrapp | N = 13 | L = 11 |

> **Important** : L'ancienneté CPTA est lue directement comme un nombre de jours (pas une date). Le scoring BQ et CPTA est **volume uniquement** (0/1/>1), pas ancienneté.

### Bilan Copropriété — indices
| Col | Contenu | Seuil anomalie |
|-----|---------|---------------|
| r[1] | Nom résidence (supprimer préfixe `^\d+-`) | — |
| r[4] | Nb lots | — |
| r[11] | % impayés copropriétaires | > 30% |
| r[16] | % charges / provisions | > 100% |
| r[18] | % dépassement travaux (peut être null) | > 100% |
| r[25] | % trésorerie / fonds permanent | **< 100%** |

> `r[7]` (Power BI pré-calculé) est **ignoré** — les anomalies sont recalculées localement depuis les 4 indicateurs ci-dessus. NaN est traité comme 0%.

---

## Modèles de données

### GeranceData (parsers/gerance.ts)
```typescript
interface GeranceData {
  quittancement: number        // Somme col[7] du fichier quittancement
  encaissement: number         // Somme col[8]
  quittancement_rows: ExcelRow[] // lignes brutes (col[0]=agence, col[7]=quitt, col[8]=encaiss)
  prop_deb: ExcelRow[]         // actifs : col[8] > 0
  prop_deb_sorti: ExcelRow[]   // sortis : col[10] > 0
  prop_cred: ExcelRow[]        // info seulement
  att_deb: ExcelRow[]          // col[8] > 0
  bq_nonrapp: ExcelRow[]       // col[11] !== 'Cloturé' ET cols 13-16 non vides
  bq_nonclot: ExcelRow[]       // col[12] in ['absent','en cours']
  cpta_nonrapp: ExcelRow[]     // toutes lignes non vides
  factures: ExcelRow[]         // col[12] !== 'réglée'
  factures_nr30: ExcelRow[]    // col[7] > 30 jours
  factures_nr60: ExcelRow[]    // col[7] > 60 jours
  att_deb_nc?: number | null
  prop_deb_nc?: number | null
  prop_cred_nc?: number | null
  bq_nonrapp_nc?: number | null
  cpta_nonrapp_nc?: number | null
  factures_nc?: number | null
}
```

### CoproData (parsers/copro.ts)
```typescript
interface CoproData {
  balance_bad: ExcelRow[]      // col[7] !== 0
  att_deb: ExcelRow[]          // col[9] > 0
  att_cred: ExcelRow[]         // col[9] < 0 (info seulement)
  ventes_deb: ExcelRow[]       // col[10] > 0
  ventes_cred: ExcelRow[]      // col[10] < 0 (info seulement)
  fourn_deb: ExcelRow[]        // col[10] > 0
  bq_nonrapp: ExcelRow[]       // col[13] !== 'Cloturé' ET cols 15-19 non vides
  bq_nonclot: ExcelRow[]       // col[14] in ['absent','en cours']
  cpta_nonrapp: ExcelRow[]     // toutes lignes non vides
  factures: ExcelRow[]         // col[12] !== 'réglée'
  factures_nr30: ExcelRow[]    // col[6] > 30 jours
  factures_nr60: ExcelRow[]    // col[6] > 60 jours
  bilan: ExcelRow[]            // col[2] === 'en gestion' (case-insensitive)
  balance_nc?: number | null
  att_deb_nc?: number | null
  att_cred_nc?: number | null
  ventes_nc?: number | null
  fourn_deb_nc?: number | null
  bq_nonrapp_nc?: number | null
  cpta_nonrapp_nc?: number | null
  factures_nc?: number | null
}
```

---

## Pipeline de données dans AuditClient.tsx

```
fichiers importés → donneesG / donneesC (données brutes)
    ↓ filterByAgence(rows, col)
filteredG / filteredC  (filtrées par agence)
    ↓ forcedOk overrides
scoredG / scoredC  (source de vérité pour render + rapport)
    ↓ computeScore*()
score: ScoreResult | null
```

**Colonnes de filtre agence (`filterByAgence`) :**
- Gérance : col[0] pour la plupart, col[1] pour bq/cpta/factures
- Copro : col[0] pour la plupart, col[1] pour factures

**Normalisation agences (`normalizeAgence`) :**
Supprime préfixe `^[A-Za-z]?\d+[-\s]+` et suffixe `\s*[-–—]\s*\d+\s*$`.
Utilisée de façon cohérente pour : sélecteur d'agences, validation, lookup historique, label PDF.

**Auto-fill sélecteur (`autoFillFromRaws`) :**
- 1 agence cochée → garantie + pointe + nbMandats auto-remplis depuis les fichiers Z
- 2+ agences cochées → garantie/pointe pré-remplis avec les valeurs de la **1ère agence cochée** (modifiable manuellement) + nbMandats sommé sur toutes les agences
- `parseGeranceZMandats` : filtre `statut.toLowerCase() === 'en gestion'` (insensible à la casse)

**Construction de la liste d'agences (sélecteur) :**
- Les fichiers Z **ne contribuent à la liste que si celle-ci est vide** (aucun fichier réel encore importé)
- Les fichiers réels reconstruisent la liste à chaque import depuis : `quittancement_rows`(col[0]), `prop_deb`, `prop_deb_sorti`, `att_deb`, `factures`(col[1]), `bq_nonrapp`(col[1]), `cpta_nonrapp`(col[1]) en gérance ; `fourn_deb`, `att_deb`, `bilan`, `ventes_deb`, `bq_nonrapp`(col[1]), `cpta_nonrapp`(**col[0]**) en copro
  - Copro `cpta_nonrapp` : col[0] = "Agence-Num" (agence réelle), col[1] = "Residence" → ne pas utiliser col[1] pour le sélecteur
- Les lignes "Total" et "Filtres appliqués" sont exclues (`startsWith('Total')` / `startsWith('Filtre')`)

---

## Système de scoring

### Principe
```
Score global = 100 − Σ(pénalités) ∈ [0, 100]
```

### GÉRANCE — max 100 pts

| Anomalie | Max | Détail |
|---------|-----|--------|
| Quittancement / Encaissement | 10 | Barème taux encaissement |
| Propriétaires débiteurs actifs | 17,5 | Montant 8,75 + Volume 8,75 |
| Propriétaires débiteurs sortis | 25 | Montant 12,5 + Volume 12,5 |
| Comptes attente débiteurs | 17,5 | Montant 8,75 + Volume 8,75 |
| Rapp. Banque 512 | 15 | Volume uniquement |
| Rapp. Compta | 15 | Volume uniquement |

#### Barème Quittancement (ratio = encaissement / quittancement)
≥100%=0 / 99-100%=−0,5 / 98-99%=−1 / 97-98%=−1,5 / 96-97%=−2 / 95-96%=−3 / 93-95%=−4 / 91-93%=−6 / 89-91%=−7,5 / 87-89%=−8,5 / 85-87%=−9 / <85%=−10

#### Barème montant Gérance actifs (max 8,75) — prop actifs + cpte attente — ratio = montant / garantie
0%=0 / ]0–0,05%]=−0,22 / ]0,05–0,1%]=−0,66 / ]0,1–0,2%]=−1,31 / ]0,2–0,3%]=−2,19 / ]0,3–0,4%]=−3,06 / ]0,4–0,5%]=−3,94 / ]0,5–0,6%]=−4,81 / ]0,6–0,7%]=−5,69 / ]0,7–1%]=−7,44 / >1%=−8,75

#### Barème volume Gérance actifs (max 8,75) — prop actifs + cpte attente — ratio = nb / nbMandats
0%=0 / ]0–1%]=−0,3 / ]1–2%]=−0,7 / ]2–3%]=−1,3 / ]3–5%]=−2,4 / ]5–7%]=−4,0 / ]7–10%]=−6,25 / >10%=−8,75

#### Barème montant Gérance sortis (max 12,5) — prop débiteurs sortis — ratio = montant / garantie
0%=0 / ]0–0,05%]=−0,31 / ]0,05–0,1%]=−0,94 / ]0,1–0,2%]=−1,88 / ]0,2–0,3%]=−3,13 / ]0,3–0,4%]=−4,38 / ]0,4–0,5%]=−5,63 / ]0,5–0,6%]=−6,88 / ]0,6–0,7%]=−8,13 / ]0,7–1%]=−10,63 / >1%=−12,5

#### Barème volume Gérance sortis (max 12,5) — prop débiteurs sortis — ratio = nb / nbMandats
0%=0 / ]0–1%]=−0,5 / ]1–2%]=−1,2 / ]2–3%]=−2,2 / ]3–5%]=−4,0 / ]5–7%]=−6,0 / ]7–10%]=−8,75 / >10%=−12,5

### COPROPRIÉTÉ — max 100 pts

| Anomalie | Max | Détail |
|---------|-----|--------|
| Balance déséquilibrée | 10 | Binaire : si existante → −10 |
| Fournisseurs débiteurs | 20 | Montant 10 + Volume 10 |
| Comptes attente débiteurs | 20 | Montant 10 + Volume 10 |
| Copropriétaires vendeurs débiteurs | 20 | Montant 10 + Volume 10 |
| Rapp. Banque 512 | 15 | Volume uniquement |
| Rapp. Compta | 15 | Volume uniquement |

#### Barème montant Copro (max 10) — commun fourn_deb + att_deb + ventes_deb — ratio = montant / garantie
0%=0 / ]0–0,05%]=−0,25 / ]0,05–0,1%]=−0,75 / ]0,1–0,2%]=−1,5 / ]0,2–0,3%]=−2,5 / ]0,3–0,4%]=−3,5 / ]0,4–0,5%]=−4,5 / ]0,5–0,6%]=−5,5 / ]0,6–0,7%]=−6,5 / ]0,7–1%]=−8,5 / >1%=−10

#### Barème volume Copro fournisseurs (max 10) — seuil max >20% — ratio = nb / nbCopros
0%=0 / ]0–1%]=−0,5 / ]1–2%]=−1,25 / ]2–5%]=−2,75 / ]5–8%]=−4,25 / ]8–12%]=−6,0 / ]12–16%]=−7,75 / ]16–20%]=−9,25 / >20%=−10

#### Barème volume Copro attente + vendeurs (max 10) — seuil max >10% — ratio = nb / nbCopros
0%=0 / ]0–1%]=−0,5 / ]1–2%]=−1,5 / ]2–3%]=−2,5 / ]3–5%]=−4,0 / ]5–7%]=−5,5 / ]7–10%]=−7,5 / >10%=−10

### Rapprochements

**BQ 512 — volume (max 15) — commun aux 2 modes :** nb=0→0 / nb=1→−10 / nb>1→−15

**CPTA Gérance — volume (max 15) :** nb=0→0 / nb=1→−10 / nb>1→−15 *(même règle que BQ)*

**CPTA Copro — volume (max 15) :** nb=0→0 / nb=1→−10 / nb>1→−15 *(même règle que BQ)*

> Les cartes BQ et CPTA **n'affichent pas** le texte de règle dans l'UI — la règle s'applique silencieusement.

### Niveaux
| Score | Label | Couleur texte | Fond |
|-------|-------|--------------|------|
| ≥ 90 | Excellent | #1A7A4A | #EAF6EF |
| ≥ 85 | Bien | #2A7A3A | #EAF6EF |
| ≥ 80 | Satisfaisant | #4A8A2A | #EAF6EF |
| ≥ 60 | Vigilance | #C05C1A | #FDF0E6 |
| ≥ 0 | Dégradé | #B01A1A | #FAEAEA |

---

## Fonctionnalités

### Note générale de l'auditeur
- Clé `'__global__'` dans `sectionNotes` — per-agence, sauvegardée/restaurée avec le snapshot automatiquement
- Affichée dans l'app entre le panneau de comparaison et la grille d'anomalies (uniquement si score calculé)
- CSS : `.global-note-block` avec bordure gauche or (`var(--gold)`)
- Dans le PDF : bloc **entre les KPIs et le tableau des anomalies**, uniquement si remplie — texte en **gras** (`font-weight:700`) avec bordure gauche or

### Cartes d'anomalies
- Scoring en temps réel à chaque coche/décoche
- Mini-liste (3 items) + **Voir plus** (modale flex) + **⬇ Excel**
- Toutes les modales "Voir plus" utilisent le layout **flex** (nom + sous-texte + montant) — **aucune table à colonnes**
- Annotations : coche inclusion/exclusion + commentaire par ligne
- Note de l'auditeur par section (y compris sections info-only)
- Clé annotation : `{cId}_{index}` — index dans le tableau **filtré** (scoredG/scoredC)
- **Annotations et notes par agence** : `annotsByAgenceRef` / `notesByAgenceRef` (useRef) — swap automatique au changement d'agence dans le sélecteur, reset au `resetAll()`, initialisés à la restauration depuis l'historique

### Carte Rapprochement Compta (`cptarapp`)
- Sous-titre affiche **"Ancienneté max : X j"** calculé depuis les lignes filtrées (gérance col[15], copro col[11])
- L'ancienneté est **affichée uniquement** dans le sous-titre de la carte — elle n'entre **pas** dans le scoring (volume uniquement)
- Dans le PDF : pas de colonne "Ancienneté" dans le tableau, pas de KPI ancienneté, texte interprétatif sans mention d'ancienneté

### Carte Rapprochements non clôturés (`bq_nonclot`)
- Carte info-only (pas de scoring) placée avant Rapp. Banque 512
- Gérance : nom = col[7], date = col[10], statut sitActuel = col[12]
- Copro : nom = col[2], date = col[11], statut sitActuel = col[14]
- Toggle par item : croix rouge (inclus) / coche verte (exclu), texte barré si exclu
- Apparaît dans la synthèse PDF avant la ligne bq_nonrapp
- **Exclusion PDF** : après `buildPDFPayload`, `generateRapport` filtre `payload.bqNonClot` ET met à jour `payload.sections[bq_nonclot].rows`, `mainStat`, `subtitle` pour que la page détail du PDF soit cohérente

### Carte État Financier Copro (bilan)
- Toujours visible en mode copro
- **Nb anomalies recalculé localement** (pas depuis r[7] Power BI) via `nbAnom(r)` :
  - Impayés > 30% → +1 anomalie
  - Charges > 100% → +1 anomalie
  - Travaux > 100% → +1 anomalie (null si colonne absente)
  - Trésorerie **< 100%** → +1 anomalie ← seuil important
- NaN traité comme 0% pour toutes les comparaisons
- Groupes : Risque ++++ (4), +++ (3), ++ (2), + (1)
- Diagramme barres + tableau fréquence + détail par groupe

### Rapport PDF
- Visible uniquement si `score !== null`
- `buildPDFPayload()` côté **CLIENT** → `POST /api/rapport/pdf` → `renderReportHTML()` côté **SERVEUR** → Puppeteer

**Structure :**
1. Page de garde (logo, agence, score + jauge SVG)
2. Synthèse (KPI strip, tableau anomalies, comparaison historique si dispo)
3. Analyse détaillée (une carte par section, interprétation contextuelle, tableau lignes)
4. Factures non réglées +60j
5. État financier copropriétés (copro uniquement)

**Tableau de synthèse PDF :**
- Colonnes : Poste d'audit / Type / Nb / **Montant** / Pénalité / Max / Statut
- La colonne Montant affiche `—` pour les postes sans montant (quittancement, bq, cpta)

**Colonnes PDF tables factures :**
- Gérance : `Mandat · Date · Entreprise · Libellé` / Montant / `Ancienneté · Note Gesteam`
- Copro : `Résidence · Date · Entreprise · Libellé` / Montant / `Ancienneté · Note Gesteam`

**Colonnes PDF tables rapprochements :**
- BQ gérance : `Banque · Date · Libellé` / Montant
- BQ copro : `Résidence · Date · Libellé` / Montant
- CPTA gérance : `Banque · Date · Libellé` / Montant ← **pas de colonne Ancienneté**
- CPTA copro : `Résidence · Date · Libellé` / Montant ← **pas de colonne Ancienneté**

**Règles PDF :**
- **JAMAIS** `@import url(fonts.googleapis.com)` → timeout Puppeteer garanti
- Polices PDF : `-apple-system, 'Helvetica Neue', Arial, 'Segoe UI', sans-serif`
- `buildPDFPayload()` côté CLIENT, `renderReportHTML()` côté SERVEUR — ne pas inverser
- Lignes justifiées : fond `#F2FAF6`, colonne "Statut" = "✓ Justifié" en vert
- Delta score arrondi à 1 décimale (`toFixed(1)`) dans l'app ET dans le PDF

**`PDFBilanGroup.rows` :**
```typescript
rows: Array<{
  name: string; lots: string
  impayes: string; impayesAnomalie: boolean   // > 30%
  charges: string; chargesAnomalie: boolean   // > 100%
  travaux: string; travauxAnomalie: boolean   // > 100%
  tresorerie: string; tresorerieAnomalie: boolean  // < 100%  ← pas -100%
}>
```

### Historique & Comparaison

**Sauvegarde mono-agence :**
- Bouton ✅ par agence dans le bloc "Validation agences" de la sidebar
- 1 entrée dans l'historique, label = nom normalisé de l'agence

**Sauvegarde multi-agences :**
- Bouton **"Valider N agences ensemble"** apparaît quand plusieurs agences sont cochées dans le sélecteur
- 1 seule entrée dans l'historique, label combiné = `"AGENCE1 + AGENCE2 + ..."` (N quelconque)
- 1 seul snapshot partagé en localStorage (clé = `c21_audit_snap_<batchId>`)

**Snapshot :**
- Clé localStorage : `c21_audit_snap_<batchId>` (**temporaire** — voir migration BDD prévue)
- Purge automatique des plus anciens batchIds si localStorage plein avant de sauvegarder
- `hasSnapshot: false` = snapshot absent → bouton restauration grisé (classe `no-snap`) mais cliquable (restauration partielle)

**Restauration :**
- Snapshot cherché par `entry.batchId` d'abord, fallback `entry.id` (legacy)
- Label multi parsé via `entry.agence.split(' + ')` → toutes les agences du batch sont recochées
- `reportAgences` = tous les noms bruts du snapshot dont le normalisé figure dans le batch

**Comparaison :**
- Panneau **toujours visible** dès qu'il existe un audit précédent avec le même ensemble d'agences
- Matching par **ensemble** (sets comparés après split sur ` + ` + sort) — insensible à l'ordre
- Checkbox pour activer/désactiver l'inclusion dans le PDF
- Delta score affiché avec `toFixed(1)` dans l'app et le PDF
- Même logique de matching dans `renderComparisonPanel` ET dans `generateRapport` (PDF)

### Export
- **⬇ Excel** par section (modal)
- **⬇ Excel global** (topbar, vert) : workbook multi-onglets Synthèse + 1 par section
- **📄 Rapport PDF** (topbar, visible si score calculé)
- **Config JSON** scoring complet

---

## Identifiants de catégories d'annotation (cId)

| cId | Usage | INFO_CIDS |
|-----|-------|-----------|
| `propdeb` | Propriétaires débiteurs (Gérance) | |
| `propcred` | Propriétaires créditeurs sortis (Gérance) | ✓ |
| `propdbsorti` | Propriétaires débiteurs sortis (Gérance) | |
| `attdeb` | Comptes attente débiteurs (Gérance) | |
| `bqrapp` | Banque non rapprochée (2 modes) | |
| `bq_nonclot` | Rapp. non clôturés (2 modes) | ✓ |
| `cptarapp` | Compta non rapprochée (2 modes) | |
| `fact60` | Factures non réglées +60j (2 modes) | |
| `balance` | Balance déséquilibrée (Copro) | |
| `fourndeb` | Fournisseurs débiteurs (Copro) | |
| `cattdeb` | Comptes attente débiteurs (Copro) | |
| `cattcred` | Comptes attente créditeurs (Copro) | ✓ |
| `ventesdeb` | Copropriétaires sortis débiteurs | |
| `ventescred` | Copropriétaires sortis créditeurs | ✓ |

`INFO_CIDS = new Set(['propcred', 'cattcred', 'ventescred', 'bq_nonclot'])` — sections sans concept justifié/injustifié (pas de `status-badge`).

---

## Structure du projet

```
audit-app/src/
├── app/
│   ├── globals.css                  # Tout le CSS
│   ├── page.tsx                     # Sélecteur de mode
│   └── audit/[mode]/page.tsx        # Page d'audit
│   └── api/
│       ├── audits/route.ts
│       ├── audits/[id]/route.ts
│       └── rapport/pdf/route.ts     # Puppeteer PDF
├── components/
│   └── AuditClient.tsx              # Composant principal 'use client'
├── lib/
│   ├── parsers/gerance.ts
│   ├── parsers/copro.ts
│   ├── report/pdf.ts                # buildPDFPayload + renderReportHTML
│   ├── scoring/engine.ts            # computeScoreGerance / computeScoreCopro
│   └── utils/format.ts             # eur(), pct(), truncate(), excelDateFmt()
└── types/audit.ts
```

---

## Design CSS

```css
:root {
  --navy: #0F1F35; --navy2: #1A3252; --gold: #C49A2E; --gold-light: #F0D080;
  --cream: #FAF8F4; --border: #E8E4DC; --text: #1A1A2E; --muted: #7A7A8C;
  --green: #1A7A4A; --green-bg: #EAF6EF; --orange: #C05C1A; --orange-bg: #FDF0E6;
  --red: #B01A1A; --red-bg: #FAEAEA; --info: #2A5A9A; --info-bg: #EAF0FA;
  --radius: 12px; --shadow: 0 2px 16px rgba(15,31,53,0.08);
}
```
Police app : **DM Sans** + **DM Serif Display** (Google Fonts). Police PDF : système uniquement.

---

## Variables d'environnement

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```
Fonctionne sans base (tout en mémoire) si non défini.

---

## Règle de plafonnement des pénalités composées

Pour toute anomalie décomposée en **montant + volume**, la pénalité finale est plafonnée :
```typescript
penalite: Math.min(penM + penV, penaliteMax)
```
Cette protection est appliquée sur les 6 anomalies concernées (propdeb, propdbsorti, attdeb en gérance ; fourndeb, cattdeb, ventesdeb en copro).

---

## Notes critiques pour Claude

- `scoredG`/`scoredC` = seule source de vérité pour render ET PDF (jamais `donneesG`/`donneesC` directement)
- `\u202f` dans JSX → expression JS `{'\u202f'}`, jamais en texte brut
- `prop_deb_sorti` existe dans `GeranceData` et a son propre barème montant (`BAREME_MONTANT_G_SORTI`, max 12,5)
- Le scoring `fact60` n'est **pas dans engine.ts** — c'est une section info affichée depuis `scoredG/C.factures_nr60`
- Comparaison PDF filtre `a.type !== 'info'` pour les anomalies comparées
- La synthèse PDF : `anomScored = syntheseRows.filter(r => !r.exclu && r.type === 'scoring').length`
- Toutes les modales utilisent le layout flex (pas de `cols` dans `renderCardActions`) — le sous-texte via `subFn` encode résidence, date sortie, ancienneté, note Gesteam selon la section
- `annotsByAgenceRef` et `notesByAgenceRef` sont des `useRef` (pas des states) — ils ne déclenchent pas de re-render mais persistent entre renders
- `restoreKey` (useState number) s'incrémente à chaque `restoreFromHistory` — intégré dans la `key` des textareas (`renderSectionNote` + `renderGlobalNote`) pour forcer leur remount même si `selectedAgence` n'a pas changé
- Quittancement/encaissement : somme **sans** `Math.abs` — les montants négatifs (remboursements) doivent rester négatifs pour correspondre aux totaux Power BI
- Badge "critique(s)" dans le header score : affiche uniquement le nombre, **sans** mention "note individuelle 0"
