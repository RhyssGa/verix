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

  return (
    <div
      className={[
        'rounded-[10px] p-[10px_6px] relative text-center min-w-0 flex flex-col items-center transition-[border-color,background] duration-150',
        isOk
          ? 'border-[1.5px] border-[#1A7A4A] bg-[#EAF6EF] cursor-default'
          : error
          ? 'border-[1.5px] border-[#B01A1A] bg-[#FAEAEA] cursor-pointer'
          : 'border-[1.5px] border-dashed border-[#E8E4DC] bg-white cursor-pointer',
      ].join(' ')}
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
      <span className="text-[18px] mb-1 block shrink-0">{config.icon}</span>
      <div className="text-[10px] font-semibold text-[#1A1A2E] mb-0.5 leading-[1.3] flex-1 flex items-center justify-center">
        {config.name}
      </div>
      <div className={[
        'text-[9px] font-semibold mt-1 shrink-0',
        isOk ? 'text-[#1A7A4A]' : error ? 'text-[#B01A1A]' : 'text-[#7A7A8C]',
      ].join(' ')}>
        {loaded ? '✓ Chargé' : isForced ? '✓ OK' : error ? '⚠ Erreur' : '+ Importer'}
      </div>

      {/* Bouton supprimer (fichier chargé ou en erreur) */}
      {(loaded || error) && (
        <button
          className="absolute top-[6px] right-2 bg-none border-none cursor-pointer text-[12px] text-[#B01A1A] px-0.5 py-0 leading-none"
          style={{ background: 'none' }}
          onClick={(e) => { e.stopPropagation(); removeFile(config.id) }}
          title="Supprimer le fichier"
        >✕</button>
      )}

      {/* Bouton "Aucune anomalie" — toujours présent pour aligner les hauteurs */}
      <button
        className={[
          'mt-[5px] block w-full px-1 py-0.5 text-[8px] font-semibold rounded-[6px] tracking-[0.3px] shrink-0',
          isForced
            ? 'border border-[#1A7A4A] bg-[#1A7A4A] text-white'
            : 'border border-[#E8E4DC] bg-transparent text-[#7A7A8C]',
          (canForce && !loaded) ? 'cursor-pointer visible' : 'cursor-default invisible',
        ].join(' ')}
        onClick={(e) => { e.stopPropagation(); if (canForce && !loaded) toggleForcedOk(config.id) }}
        title={isForced ? 'Annuler — remettre ce fichier en attente' : 'Forcer aucune anomalie sans importer le fichier'}
      >
        {isForced ? '✕ Annuler' : 'Aucune anomalie'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFile(e, config.id)}
      />
    </div>
  )
}
