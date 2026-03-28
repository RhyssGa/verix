'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { ManualDataForm } from '@/components/audit/ManualDataForm'

import { GERANCE_FILE_CONFIGS, COPRO_FILE_CONFIGS } from '@/constants/fileConfigs'

interface SidebarProps {
  mode: 'gerance' | 'copro'
}

const sbLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: '#7A7A8C',
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: '1px solid #E8E4DC',
}

export function Sidebar({ mode }: SidebarProps) {
  const loadedFiles = useAuditStore((s) => s.loadedFiles)
  const forcedOk = useAuditStore((s) => s.forcedOk)
  const configs = mode === 'gerance' ? GERANCE_FILE_CONFIGS : COPRO_FILE_CONFIGS

  return (
    <div style={{
      background: '#fff',
      borderRight: '1px solid #E8E4DC',
      padding: '24px 20px',
      overflowY: 'auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Mode actif + switcher */}
      <div>
        <div style={{
          background: '#0B1929',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ fontSize: 22 }}>{mode === 'gerance' ? '🏠' : '🏢'}</span>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Mode actif
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#C49A2E', letterSpacing: '0.2px' }}>
            {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
          </div>
        </div>
      </div>

      {/* Identification + données manuelles */}
      <ManualDataForm mode={mode} />

      {/* Fichiers chargés */}
      <div>
        <div style={sbLabel}>Fichiers chargés</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {configs.map((config) => {
            const loaded = !!loadedFiles[config.id] || !!forcedOk[config.id]
            return (
              <div
                key={config.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 11,
                  color: loaded ? '#1A7A4A' : '#7A7A8C',
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: loaded ? '#EAF6EF' : '#FAF8F4',
                  gap: 6,
                }}
              >
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: loaded ? '#1A7A4A' : '#ccc',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {config.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>


    </div>
  )
}
