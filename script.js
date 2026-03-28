(async () => {
  // 1. Lire l'historique
  const history = JSON.parse(localStorage.getItem('c21_audit_history') || '[]')
  console.log(`Historique : ${history.length} entrées`)
  if (!history.length) return

  // 2. Dédupliquer par batchId (multi-agences = même batch)
  const seen = new Set()
  const batches = history.filter(e => {
    if (seen.has(e.batchId)) return false
    seen.add(e.batchId); return true
  })
  console.log(`Batches uniques : ${batches.length}`)

  let ok = 0, noSnap = 0, err = 0

  for (const entry of batches) {
    // 3. Chercher le snapshot (batchId d'abord, puis id legacy)
    const raw =
      localStorage.getItem(`c21_audit_snap_${entry.batchId}`) ??
      localStorage.getItem(`c21_audit_snap_${entry.id}`)

    if (!raw) {
      console.warn(`⚠ Pas de snapshot — ${entry.agence} (${entry.timestamp?.slice(0,10)})`)
      // Migrer quand même l'entrée history sans snapshot
      try {
        await fetch('/api/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: entry.batchId,
            agence: entry.agence,
            mode: entry.mode,
            scoreGlobal: entry.scoreGlobal ?? 0,
            niveau: entry.niveau ?? '',
            nbAnomalies: entry.nbAnomalies ?? 0,
            totalPenalite: entry.totalPenalite ?? 0,
            metrics: entry.metrics ?? {},
            sectionNotes: entry.sectionNotes ?? {},
            snapshot: {} // snapshot vide
          })
        })
        noSnap++
      } catch (e) { console.error(e); err++ }
      continue
    }

    // 4. Migrer avec snapshot complet
    try {
      const snapshot = JSON.parse(raw)
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: entry.batchId,
          agence: entry.agence,
          mode: entry.mode,
          scoreGlobal: entry.scoreGlobal ?? 0,
          niveau: entry.niveau ?? '',
          nbAnomalies: entry.nbAnomalies ?? 0,
          totalPenalite: entry.totalPenalite ?? 0,
          metrics: entry.metrics ?? {},
          sectionNotes: entry.sectionNotes ?? {},
          snapshot
        })
      })
      if (res.ok) {
        console.log(`✓ ${entry.agence} — score ${entry.scoreGlobal} — ${entry.timestamp?.slice(0,10)}`)
        ok++
      } else {
        const e = await res.json()
        console.error(`✗ ${entry.agence} : ${e.error}`)
        err++
      }
    } catch (e) {
      console.error(`✗ ${entry.agence} :`, e)
      err++
    }
  }

  console.log(`\n✅ ${ok} migrés avec snapshot | ${noSnap} sans snapshot | ${err} erreurs`)
})()
