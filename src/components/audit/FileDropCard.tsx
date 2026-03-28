'use client'

import { useRef, useState, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useFileUpload } from '@/hooks/useFileUpload'
import type { FileConfig } from '@/types/audit'

interface FileDropCardProps {
  config: FileConfig
  mode: 'gerance' | 'copro'
}

export function FileDropCard({ config, mode }: FileDropCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedFiles = useAuditStore((s) => s.loadedFiles)
  const fileErrors = useAuditStore((s) => s.fileErrors)
  const forcedOk = useAuditStore((s) => s.forcedOk)
  const toggleForcedOk = useAuditStore((s) => s.toggleForcedOk)
  const { handleFile, removeFile } = useFileUpload()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const loaded = mounted ? loadedFiles[config.id] : undefined
  const error = mounted ? fileErrors[config.id] : undefined
  const isForced = mounted ? forcedOk[config.id] : false

  const NO_FORCE_IDS: Record<string, string[]> = {
    gerance: ['z_pointe', 'z_mandats', 'quittancement', 'factures'],
    copro: ['z_pointe', 'factures', 'bilan'],
  }
  const canForce = !NO_FORCE_IDS[mode]?.includes(config.id)

  const isOk = loaded || isForced

  const cardStyle: React.CSSProperties = {
    border: isOk
      ? '1.5px solid #1A7A4A'
      : error
      ? '1.5px solid #B01A1A'
      : '1.5px dashed #E8E4DC',
    borderRadius: 10,
    padding: '10px 6px',
    cursor: isOk ? 'default' : 'pointer',
    position: 'relative',
    background: isOk ? '#EAF6EF' : error ? '#FAEAEA' : '#fff',
    transition: 'border-color .15s, background .15s',
    textAlign: 'center' as const,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  return (
    <div
      style={cardStyle}
      onClick={() => !isOk && inputRef.current?.click()}
      onMouseOver={(e) => {
        if (!isOk && !error) {
          e.currentTarget.style.borderColor = '#1A3252'
          e.currentTarget.style.background = '#EAF0FA'
        }
      }}
      onMouseOut={(e) => {
        if (!isOk && !error) {
          e.currentTarget.style.borderColor = '#E8E4DC'
          e.currentTarget.style.background = '#fff'
        }
      }}
    >
      <span style={{ fontSize: 18, marginBottom: 4, display: 'block', flexShrink: 0 }}>{config.icon}</span>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: '#1A1A2E',
        marginBottom: 2,
        lineHeight: 1.3,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {config.name}
      </div>
      <div style={{
        fontSize: 9,
        fontWeight: 600,
        marginTop: 4,
        color: isOk ? '#1A7A4A' : error ? '#B01A1A' : '#7A7A8C',
        flexShrink: 0,
      }}>
        {loaded ? '✓ Chargé' : isForced ? '✓ OK' : error ? '⚠ Erreur' : '+ Importer'}
      </div>

      {/* Bouton supprimer (fichier chargé) */}
      {loaded && (
        <button
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: '#B01A1A',
            padding: '0 2px',
            lineHeight: 1,
          }}
          onClick={(e) => { e.stopPropagation(); removeFile(config.id) }}
          title="Supprimer le fichier"
        >✕</button>
      )}

      {/* Bouton "Aucune anomalie" — toujours présent pour aligner les hauteurs */}
      <button
        style={{
          marginTop: 5,
          display: 'block',
          width: '100%',
          padding: '2px 4px',
          fontSize: 8,
          fontWeight: 600,
          border: `1px solid ${isForced ? '#1A7A4A' : '#E8E4DC'}`,
          borderRadius: 6,
          cursor: canForce && !loaded ? 'pointer' : 'default',
          background: isForced ? '#1A7A4A' : 'transparent',
          color: isForced ? '#fff' : '#7A7A8C',
          letterSpacing: '0.3px',
          visibility: (canForce && !loaded) ? 'visible' : 'hidden',
          flexShrink: 0,
        }}
        onClick={(e) => { e.stopPropagation(); if (canForce && !loaded) toggleForcedOk(config.id) }}
        title={isForced ? 'Annuler — remettre ce fichier en attente' : 'Forcer aucune anomalie sans importer le fichier'}
      >
        {isForced ? '✕ Annuler' : 'Aucune anomalie'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e, config.id)}
      />
    </div>
  )
}
