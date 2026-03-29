'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { ManualDataForm } from '@/components/audit/ManualDataForm'

import { GERANCE_FILE_CONFIGS, COPRO_FILE_CONFIGS } from '@/constants/fileConfigs'

interface SidebarProps {
  mode: 'gerance' | 'copro'
}

export function Sidebar({ mode }: SidebarProps) {
  const loadedFiles = useAuditStore((s) => s.loadedFiles)
  const forcedOk = useAuditStore((s) => s.forcedOk)
  const configs = mode === 'gerance' ? GERANCE_FILE_CONFIGS : COPRO_FILE_CONFIGS

  return (
    <div className="bg-white border-r border-[#E8E4DC] px-5 py-6 overflow-y-auto h-full flex flex-col gap-3">
      {/* Mode actif + switcher */}
      <div>
        <div className="bg-[#0B1929] rounded-[10px] px-[14px] py-3 mb-0 flex flex-col items-center gap-1">
          <span className="text-[22px]">{mode === 'gerance' ? '🏠' : '🏢'}</span>
          <div className="text-[10px] text-[rgba(255,255,255,0.5)] font-semibold tracking-[0.6px] uppercase">
            Mode actif
          </div>
          <div className="text-[15px] font-bold text-[#C49A2E] tracking-[0.2px]">
            {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
          </div>
        </div>
      </div>

      {/* Identification + données manuelles */}
      <ManualDataForm mode={mode} />

      {/* Fichiers chargés */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-[#7A7A8C] mb-[14px] pb-2 border-b border-[#E8E4DC]">
          Fichiers chargés
        </div>
        <div className="flex flex-col gap-1.5">
          {configs.map((config) => {
            const loaded = !!loadedFiles[config.id] || !!forcedOk[config.id]
            return (
              <div
                key={config.id}
                className={[
                  'flex items-center text-[11px] px-2 py-[5px] rounded-[6px] gap-1.5',
                  loaded ? 'text-[#1A7A4A] bg-[#EAF6EF]' : 'text-[#7A7A8C] bg-[#FAF8F4]',
                ].join(' ')}
              >
                <span className={[
                  'w-[7px] h-[7px] rounded-full inline-block shrink-0',
                  loaded ? 'bg-[#1A7A4A]' : 'bg-[#ccc]',
                ].join(' ')} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
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
