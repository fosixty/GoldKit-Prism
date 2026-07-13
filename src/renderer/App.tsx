import { useCallback, useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import DropZone from './components/DropZone'
import SessionViewer from './components/SessionViewer'
import ExportDialog from './components/ExportDialog'
import ProgressLogger from './components/ProgressLogger'
import SettingsPanel from './components/SettingsPanel'
import PtformatDebugPanel from './components/PtformatDebugPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSession } from './hooks/useSession'
import { useExport } from './hooks/useExport'
import { useAppStore } from './store/appStore'
import type { PtformatDebugRecord } from '@shared/types'

const ALIGNMENT_WARNING =
  'Timeline alignment unavailable. Fallback raw export is still available.'

export default function App() {
  const session = useAppStore((s) => s.session)
  const parseWarnings = useAppStore((s) => s.parseWarnings)
  const validation = useAppStore((s) => s.validation)
  const isValidating = useAppStore((s) => s.isValidating)
  const isParsing = useAppStore((s) => s.isParsing)
  const parseError = useAppStore((s) => s.parseError)
  const exportOptions = useAppStore((s) => s.exportOptions)
  const progressEvents = useAppStore((s) => s.progressEvents)
  const exportSummary = useAppStore((s) => s.exportSummary)
  const isExporting = useAppStore((s) => s.isExporting)
  const exportError = useAppStore((s) => s.exportError)
  const showSettings = useAppStore((s) => s.showSettings)
  const preferences = useAppStore((s) => s.preferences)
  const setPreferences = useAppStore((s) => s.setPreferences)
  const setExportOptions = useAppStore((s) => s.setExportOptions)
  const setShowSettings = useAppStore((s) => s.setShowSettings)

  const [showPtformatDebug, setShowPtformatDebug] = useState(false)
  const [ptformatDebug, setPtformatDebug] = useState<PtformatDebugRecord | null>(null)

  const { loadSession, browseSession } = useSession()
  const { startExport, cancelExport } = useExport()

  const isAlignmentWarningOnly = Boolean(session && parseError === ALIGNMENT_WARNING)
  const isFatalParseError = Boolean(parseError && !isAlignmentWarningOnly)

  useEffect(() => {
    window.prism.getPreferences().then(setPreferences)
  }, [setPreferences])

  const handleBrowseOutput = useCallback(async () => {
    const dir = await window.prism.openOutputDir()
    if (dir) setExportOptions({ outputDir: dir })
  }, [setExportOptions])

  const handleSavePreferences = useCallback(
    async (partial: Partial<typeof preferences>) => {
      const updated = await window.prism.setPreferences(partial)
      setPreferences(updated)
    },
    [setPreferences],
  )

  const handleShowPtformatDebug = useCallback(async () => {
    const debug = await window.prism.getLastPtformatDebug()
    setPtformatDebug(debug)
    setShowPtformatDebug(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExporting) cancelExport()
      if (e.key === 'Enter' && session && !isExporting && exportOptions.outputDir) {
        startExport()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelExport, exportOptions.outputDir, isExporting, session, startExport])

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col">
        <TopBar onToggleSettings={() => setShowSettings(true)} />

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
          {!session && (
            <DropZone
              isParsing={isParsing}
              onFileSelected={loadSession}
              onBrowse={browseSession}
            />
          )}

          {isAlignmentWarningOnly && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <div>{parseError}</div>
              <button
                type="button"
                onClick={handleShowPtformatDebug}
                className="mt-2 text-xs text-amber-100 underline hover:text-white"
              >
                Show ptformat debug
              </button>
            </div>
          )}

          {isFatalParseError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <div>{parseError}</div>
            </div>
          )}

          {session && (
            <>
              <SessionViewer session={session} warnings={parseWarnings} />
              <ExportDialog
                options={exportOptions}
                session={session}
                validation={validation}
                isValidating={isValidating}
                isExporting={isExporting}
                onChange={setExportOptions}
                onBrowseOutput={handleBrowseOutput}
                onExport={() => startExport()}
                onCancel={cancelExport}
              />
            </>
          )}

          <ProgressLogger events={progressEvents} summary={exportSummary} />

          {exportError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {exportError}
            </div>
          )}
        </main>

        {showSettings && (
          <SettingsPanel
            preferences={preferences}
            onChange={handleSavePreferences}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showPtformatDebug && (
          <PtformatDebugPanel
            debug={ptformatDebug}
            onClose={() => setShowPtformatDebug(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
