'use client'

import { GERANCE_FILE_CONFIGS, COPRO_FILE_CONFIGS } from '@/constants/fileConfigs'
import { FileDropCard } from './FileDropCard'

interface FileUploadGridProps {
  mode: 'gerance' | 'copro'
}

export function FileUploadGrid({ mode }: FileUploadGridProps) {
  const configs = mode === 'gerance' ? GERANCE_FILE_CONFIGS : COPRO_FILE_CONFIGS

  return (
    <div
      className="grid gap-2 mb-8"
      style={{ gridTemplateColumns: `repeat(${configs.length}, 1fr)` }}
    >
      {configs.map((config) => (
        <FileDropCard key={config.id} config={config} mode={mode} />
      ))}
    </div>
  )
}
