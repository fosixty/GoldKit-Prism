import clsx from 'clsx'
import { FileAudio, Loader2, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'

interface DropZoneProps {
  isParsing: boolean
  onFileSelected: (path: string) => void
  onBrowse: () => void
}

export default function DropZone({ isParsing, onFileSelected, onBrowse }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragOver(false)
      const file = event.dataTransfer.files[0]
      if (!file) return
      const filePath = window.prism.getPathForFile(file)
      if (filePath?.toLowerCase().endsWith('.ptx')) {
        onFileSelected(filePath)
      }
    },
    [onFileSelected],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onBrowse}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onBrowse()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={clsx(
        'panel flex cursor-pointer flex-col items-center justify-center gap-4 border-dashed px-8 py-14 transition',
        isDragOver ? 'border-goldkit-gold bg-goldkit-gold/5' : 'hover:border-goldkit-gold/60',
      )}
      aria-label="Drop Pro Tools session file"
    >
      {isParsing ? (
        <Loader2 className="h-12 w-12 animate-spin text-goldkit-gold" aria-hidden />
      ) : isDragOver ? (
        <Upload className="h-12 w-12 text-goldkit-gold" aria-hidden />
      ) : (
        <FileAudio className="h-12 w-12 text-goldkit-muted" aria-hidden />
      )}
      <div className="text-center">
        <p className="text-lg font-medium text-zinc-100">
          {isParsing ? 'Parsing session...' : 'Drop .ptx session file here'}
        </p>
        <p className="mt-1 text-sm text-goldkit-muted">or click to browse</p>
      </div>
    </div>
  )
}
