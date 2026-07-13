import type { ExportOptions, ExportValidationResult, SessionMetadata } from '@shared/types'
import { FolderOpen } from 'lucide-react'

interface ExportDialogProps {
  options: ExportOptions
  session: SessionMetadata
  validation: ExportValidationResult | null
  isValidating: boolean
  isExporting: boolean
  onChange: (options: Partial<ExportOptions>) => void
  onBrowseOutput: () => void
  onExport: () => void
  onCancel: () => void
}

export default function ExportDialog({
  options,
  session,
  validation,
  isValidating,
  isExporting,
  onChange,
  onBrowseOutput,
  onExport,
  onCancel,
}: ExportDialogProps) {
  const estimate = validation?.estimatedOutputBytes ?? 0
  const hasWarnings =
    (validation?.missingFiles.length ?? 0) > 0 ||
    (validation?.sampleRateMismatches.length ?? 0) > 0 ||
    (validation?.unsupportedFormats.length ?? 0) > 0
  const alignmentAvailable = !!session.hasAlignment && session.tracks.length > 0
  const isRawMode = options.exportMode === 'raw'
  const alignedExportBlocked =
    !isRawMode && (isValidating || (alignmentAvailable && validation !== null && !validation.canExport))

  return (
    <section className="panel p-5" aria-label="Export settings">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-goldkit-muted">
        Export
      </h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-goldkit-muted">Output Folder</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={options.outputDir}
              placeholder="Select output folder..."
              className="flex-1 rounded-lg border border-goldkit-border bg-goldkit-bg px-3 py-2 text-sm text-zinc-200"
              aria-label="Output folder path"
            />
            <button
              type="button"
              onClick={onBrowseOutput}
              className="btn-secondary flex items-center gap-2"
              disabled={isExporting}
            >
              <FolderOpen className="h-4 w-4" />
              Browse
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-goldkit-border bg-goldkit-bg px-3 py-2 text-sm text-zinc-300">
          Estimated output size: {(estimate / (1024 * 1024)).toFixed(1)} MB
          <br />
          Session format: {(session.sampleRate / 1000).toFixed(0)}kHz {session.bitDepth}-bit WAV
          {!alignmentAvailable && (
            <>
              <br />
              Timeline alignment unavailable. Fallback raw export is still available.
            </>
          )}
        </div>

        {isValidating && !isRawMode && (
          <p className="text-sm text-goldkit-muted">Checking source files...</p>
        )}

        <div className="space-y-2 rounded-lg border border-goldkit-border bg-goldkit-bg px-3 py-2 text-sm text-zinc-300">
          <p className="mb-1 text-goldkit-muted">Export mode</p>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-mode"
              value="aligned"
              checked={options.exportMode === 'aligned'}
              onChange={() => onChange({ exportMode: 'aligned' })}
              disabled={isExporting || !alignmentAvailable}
            />
            <span>
              Timeline-aligned export
              {!alignmentAvailable && ' (unavailable for this session)'}
            </span>
          </label>
          <label className="flex items-center gap-2 text-zinc-400">
            <input
              type="radio"
              name="export-mode"
              value="raw"
              checked={options.exportMode === 'raw'}
              onChange={() => onChange({ exportMode: 'raw' })}
              disabled={isExporting}
            />
            <span>Copy all source audio files (clip bin, no timeline alignment)</span>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={options.autoOrganize}
            onChange={(e) => onChange({ autoOrganize: e.target.checked })}
            disabled={isExporting}
            className="rounded border-goldkit-border"
          />
          Auto-organize by session name
        </label>

        {hasWarnings && !isRawMode && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <p className="font-medium">Validation warnings detected</p>
            <ul className="mt-1 list-inside list-disc">
              <li>{validation?.missingFiles.length ?? 0} missing files</li>
              <li>{validation?.sampleRateMismatches.length ?? 0} sample-rate mismatches</li>
              <li>{validation?.unsupportedFormats.length ?? 0} unsupported clips</li>
            </ul>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.continueWithIssues}
                onChange={(e) => onChange({ continueWithIssues: e.target.checked })}
                disabled={isExporting}
              />
              Continue export and skip invalid regions
            </label>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={!isExporting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onExport}
          className="btn-primary"
          disabled={isExporting || !options.outputDir || alignedExportBlocked}
        >
          {isExporting
            ? 'Exporting...'
            : isValidating && !isRawMode
              ? 'Checking files...'
            : isRawMode
              ? 'Export (Raw)'
              : 'Export (Aligned)'}
        </button>
      </div>
    </section>
  )
}
