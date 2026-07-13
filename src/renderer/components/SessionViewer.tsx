import type { SessionMetadata } from '@shared/types'

interface SessionViewerProps {
  session: SessionMetadata
  warnings: string[]
}

const MAX_LISTED_SOURCE_FILES = 20

function channelLabel(channels: number): string {
  if (channels === 1) return 'Mono'
  if (channels === 2) return 'Stereo'
  return `${channels}ch`
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

export default function SessionViewer({ session, warnings }: SessionViewerProps) {
  const audioTracks = session.tracks
  const fallbackFiles = session.fallbackSourceFiles ?? []
  const hasAlignedTracks = audioTracks.length > 0
  const hasFallbackFiles = fallbackFiles.length > 0
  const durationMinutes = Math.floor(session.durationSeconds / 60)
  const durationSeconds = Math.round(session.durationSeconds % 60)

  const summaryLine = hasAlignedTracks
    ? `${(session.sampleRate / 1000).toFixed(0)}kHz ${session.bitDepth}-bit · ${session.totalTracks} track${session.totalTracks === 1 ? '' : 's'} · ${durationMinutes}m ${durationSeconds}s`
    : hasFallbackFiles
      ? `${(session.sampleRate / 1000).toFixed(0)}kHz ${session.bitDepth}-bit · ${fallbackFiles.length} source audio file${fallbackFiles.length === 1 ? '' : 's'} discovered`
      : `${(session.sampleRate / 1000).toFixed(0)}kHz ${session.bitDepth}-bit · no audio files discovered`

  const listedFallbackFiles = fallbackFiles.slice(0, MAX_LISTED_SOURCE_FILES)
  const remainingFallbackCount = Math.max(0, fallbackFiles.length - listedFallbackFiles.length)

  return (
    <section className="panel p-5" aria-label="Loaded session">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-goldkit-muted">
        Loaded Session
      </h2>
      <p className="mb-4 text-lg font-semibold text-zinc-100">{session.sessionName}</p>
      <p className="mb-4 text-sm text-goldkit-muted">{summaryLine}</p>

      {hasAlignedTracks ? (
        <ul className="space-y-2">
          {audioTracks.map((track) => (
            <li
              key={track.name}
              className="flex items-center justify-between rounded-lg bg-goldkit-bg px-3 py-2 text-sm"
            >
              <span className="text-zinc-200">{track.name}</span>
              <span className="text-goldkit-muted">
                {channelLabel(track.channels)} · {track.regions.length} region
                {track.regions.length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      ) : hasFallbackFiles ? (
        <div>
          <p className="mb-2 text-sm text-zinc-300">Discovered source audio</p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {listedFallbackFiles.map((filePath) => (
              <li
                key={filePath}
                className="rounded-lg bg-goldkit-bg px-3 py-2 text-sm text-zinc-200"
              >
                {basename(filePath)}
              </li>
            ))}
          </ul>
          {remainingFallbackCount > 0 && (
            <p className="mt-2 text-xs text-goldkit-muted">
              and {remainingFallbackCount} more
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-goldkit-muted">No audio files were discovered for this session.</p>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-goldkit-muted">
        Exports linked source audio only. Plugin and bus processing are not rendered.
      </p>
    </section>
  )
}
