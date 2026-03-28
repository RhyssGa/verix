'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './page.module.css'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState('')

  function handleConfirm() {
    if (!mode) return
    router.push(`/audit/${mode}`)
  }

  return (
    <div className={styles.modeScreen}>
      <div className={styles.modeCard}>
        <div className={styles.modeLogo}>21</div>
        <h1 className={styles.modeTitle}>Audit Comptable Century 21</h1>
        <p className={styles.modeSubtitle}>Choisissez le type d&apos;audit</p>
        <select
          className={styles.modeSelect}
          value={mode}
          onChange={e => setMode(e.target.value)}
        >
          <option value="">-- Choisissez le type d&apos;audit --</option>
          <option value="gerance">Gérance</option>
          <option value="copro">Copropriété</option>
        </select>
        <button
          className={styles.modeBtn}
          onClick={handleConfirm}
          disabled={!mode}
        >
          Démarrer l&apos;audit
        </button>
      </div>
    </div>
  )
}
