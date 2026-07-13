import type { ExportProgressEvent, ExportSummary } from '@shared/types'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'

interface ProgressLoggerProps {
  events: ExportProgressEvent[]
  summary: ExportSummary | null
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'complete':
      return <Check className="h-4 w-4 text-emerald-400" aria-hidden />
    case 'error':
      return <X className="h-4 w-4 text-red-400" aria-hidden />
    case 'in-progress':
      return <Loader2 className="h-4 w-4 animate-spin text-goldkit-gold" aria-hidden />
    default:
      return <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}m ${rem}s`
}

export default function ProgressLogger({ events, summary }: ProgressLoggerProps) {
  if (events.length === 0 && !summary) return null
  const latest = events[events.length - 1]
  const percent = latest?.percentComplete ?? (summary ? 100 : 0)

  return (
    <section className="panel p-5" aria-label="Export progress" aria-live="polite">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-goldkit-muted">{latest?.message ?? 'Export progress'}</span>
          <span className="font-medium text-goldkit-gold">{Math.round(percent)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-goldkit-bg">
          <div
            className="h-full bg-prism transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
        {events.map((event, index) => (
          <div key={`${event.trackName}-${index}`} className="flex items-center gap-2 rounded px-2 py-1">
            <StatusIcon status={event.status} />
            <span className="flex-1 text-zinc-300">{event.trackName}</span>
            <span className="text-goldkit-muted">{event.message}</span>
          </div>
        ))}
      </div>

      {summary && (
        <div className="mt-4 rounded-lg bg-goldkit-bg px-3 py-2 text-sm text-zinc-300">
          {summary.exportedTracks}/{summary.totalTracks} tracks exported ·{' '}
          {summary.skippedRegions} skipped region{summary.skippedRegions === 1 ? '' : 's'} ·{' '}
          {formatBytes(summary.totalBytes)} · {formatDuration(summary.durationMs)}
        </div>
      )}
    </section>
  )
}
