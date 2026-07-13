import { useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { SessionMetadata } from '@shared/types'

export function useExport() {
  const session = useAppStore((s) => s.session)
  const exportOptions = useAppStore((s) => s.exportOptions)
  const validation = useAppStore((s) => s.validation)
  const setExporting = useAppStore((s) => s.setExporting)
  const pushProgressEvent = useAppStore((s) => s.pushProgressEvent)
  const setExportSummary = useAppStore((s) => s.setExportSummary)
  const setExportError = useAppStore((s) => s.setExportError)
  const resetExport = useAppStore((s) => s.resetExport)

  useEffect(() => {
    const unsubscribe = window.prism.onExportProgress((progress) => {
      pushProgressEvent(progress)
      if (progress.status === 'complete' && progress.percentComplete >= 100) {
        setExporting(false)
      }
    })
    return unsubscribe
  }, [pushProgressEvent, setExporting])

  const startExport = useCallback(
    async (activeSession: SessionMetadata = session!) => {
      if (!activeSession) return
      if (!exportOptions.outputDir) {
        setExportError('Select an output folder before exporting.')
        return
      }
      if (exportOptions.exportMode === 'aligned') {
        if (!validation?.canExport) {
          setExportError('Session cannot be exported because no valid aligned tracks were found.')
          return
        }

        const hasBlockingIssues =
          validation.missingFiles.length > 0 ||
          validation.sampleRateMismatches.length > 0 ||
          validation.unsupportedFormats.length > 0
        if (hasBlockingIssues && !exportOptions.continueWithIssues) {
          setExportError('Resolve or acknowledge validation warnings before export.')
          return
        }
      }

      resetExport()
      setExporting(true)
      setExportError('')

      try {
        const summary = await window.prism.exportStems(activeSession.sessionPath, exportOptions)
        setExportSummary(summary)
        pushProgressEvent({
          trackName: 'Summary',
          status: summary.errors.length > 0 ? 'error' : 'complete',
          percentComplete: 100,
          message: `Exported ${summary.exportedTracks}/${summary.totalTracks} tracks`,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setExportError(message)
        setExporting(false)
      }
    },
    [
      exportOptions,
      pushProgressEvent,
      resetExport,
      session,
      setExportError,
      setExporting,
      setExportSummary,
      validation,
    ],
  )

  const cancelExport = useCallback(async () => {
    await window.prism.cancelExport()
    setExporting(false)
  }, [setExporting])

  return { startExport, cancelExport }
}
