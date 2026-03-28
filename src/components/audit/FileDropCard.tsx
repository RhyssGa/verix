'use client'

import { useRef } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useFileUpload } from '@/hooks/useFileUpload'
import type { FileConfig } from '@/types/audit'

interface FileDropCardProps {
  config: FileConfig
  mode: 'gerance' | 'copro'
}

export function FileDropCard({ config }: FileDropCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedFiles = useAuditStore((s) => s.loadedFiles)
  const fileErrors = useAuditStore((s) => s.fileErrors)
  const { handleFile, removeFile } = useFileUpload()

  const loaded = loadedFiles[config.id]
  const error = fileErrors[config.id]

  const cardStyle: React.CSSProperties = {
    border: loaded
      ? '1.5px solid #1A7A4A'
      : error
      ? '1.5px solid #B01A1A'
      : '1.5px dashed #E8E4DC',
    borderRadius: 12,
    padding: '16px 14px',
    cursor: loaded ? 'default' : 'pointer',
    position: 'relative',
    background: loaded ? '#EAF6EF' : error ? '#FAEAEA' : '#fff',
    transition: 'border-color .15s, background .15s',
    textAlign: 'center' as const,
  }

  return (
    <div
      style={cardStyle}
      onClick={() => !loaded && inputRef.current?.click()}
      onMouseOver={(e) => {
        if (!loaded && !error) {
          e.currentTarget.style.borderColor = '#1A3252'
          e.currentTarget.style.background = '#EAF0FA'
        }
      }}
      onMouseOut={(e) => {
        if (!loaded && !error) {
          e.currentTarget.style.borderColor = '#E8E4DC'
          e.currentTarget.style.background = '#fff'
        }
      }}
    >
      <span style={{ fontSize: 22, marginBottom: 7, display: 'block' }}>{config.icon}</span>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', marginBottom: 3 }}>
        {config.name}
      </div>
      <div style={{ fontSize: 10, color: '#7A7A8C', lineHeight: 1.4 }}>
     {config.desc}
      </div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        marginTop: 7,
        color: loaded ? '#1A7A4A' : error ? '#B01A1A' : '#7A7A8C',
      }}>
        {loaded ? `✓ ${loaded}` : error ? `⚠ ${error}` : '+ Importer'}
      </div>
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
          title="Supprimer"
        >✕</button>
      )}
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
