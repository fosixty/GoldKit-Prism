import type { PtformatDebugRecord } from '@shared/types'
import { Copy, X } from 'lucide-react'

interface PtformatDebugPanelProps {
  debug: PtformatDebugRecord | null
  onClose: () => void
}

function formatDebugText(debug: PtformatDebugRecord): string {
  const command = `"${debug.binaryPath}" ${debug.args.map((arg) => JSON.stringify(arg)).join(' ')}`
  return [
    `timestamp: ${debug.timestamp}`,
    `binaryPath: ${debug.binaryPath}`,
    `binaryExists: ${debug.binaryExists}`,
    `command: ${command}`,
    `cwd: ${debug.cwd}`,
    `exitCode: ${debug.exitCode ?? 'null'}`,
    `parseMode: ${debug.parseMode}`,
    '',
    '--- stdout ---',
    debug.stdout || '(empty)',
    '',
    '--- stderr ---',
    debug.stderr || '(empty)',
  ].join('\n')
}

export default function PtformatDebugPanel({ debug, onClose }: PtformatDebugPanelProps) {
  const handleCopy = async () => {
    if (!debug) return
    await navigator.clipboard.writeText(formatDebugText(debug))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ptformat debug"
    >
      <div className="panel flex max-h-[85vh] w-full max-w-3xl flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">ptformat debug</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-goldkit-muted hover:text-white"
            aria-label="Close ptformat debug"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!debug ? (
          <p className="text-sm text-goldkit-muted">
            No ptformat debug record is available yet. Load a session to capture the latest
            ptformat run.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-2 text-sm text-zinc-300">
              <div>
                <span className="text-goldkit-muted">Binary: </span>
                {debug.binaryPath} ({debug.binaryExists ? 'found' : 'missing'})
              </div>
              <div>
                <span className="text-goldkit-muted">Command: </span>
                <code className="break-all text-xs">
                  {`"${debug.binaryPath}" ${debug.args.map((arg) => JSON.stringify(arg)).join(' ')}`}
                </code>
              </div>
              <div>
                <span className="text-goldkit-muted">cwd: </span>
                {debug.cwd}
              </div>
              <div>
                <span className="text-goldkit-muted">exitCode: </span>
                {debug.exitCode ?? 'null'}
              </div>
              <div>
                <span className="text-goldkit-muted">parseMode: </span>
                {debug.parseMode}
              </div>
              <div>
                <span className="text-goldkit-muted">timestamp: </span>
                {debug.timestamp}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-goldkit-muted">
                  stdout
                </p>
                <pre className="max-h-40 overflow-auto rounded-lg bg-goldkit-bg p-3 text-xs text-zinc-200">
                  {debug.stdout || '(empty)'}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-goldkit-muted">
                  stderr
                </p>
                <pre className="max-h-40 overflow-auto rounded-lg bg-goldkit-bg p-3 text-xs text-zinc-200">
                  {debug.stderr || '(empty)'}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleCopy} className="btn-secondary inline-flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy to clipboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
