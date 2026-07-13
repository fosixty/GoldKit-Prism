import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/constants'
import type {
  ExportOptions,
  ExportProgressEvent,
  PtformatDebugRecord,
  ExportValidationResult,
  ParseResult,
  Preferences,
} from '../shared/types'

const prismApi = {
  openPtxFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_OPEN_PTX),
  openOutputDir: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_OPEN_OUTPUT_DIR),
  ptxParse: (ptxPath: string): Promise<ParseResult> => ipcRenderer.invoke(IPC.PTX_PARSE, ptxPath),
  exportValidate: (sessionPath: string): Promise<ExportValidationResult> =>
    ipcRenderer.invoke(IPC.EXPORT_VALIDATE, sessionPath),
  exportStems: (sessionPath: string, options: ExportOptions) =>
    ipcRenderer.invoke(IPC.EXPORT_STEMS, sessionPath, options),
  cancelExport: (): Promise<boolean> => ipcRenderer.invoke(IPC.EXPORT_CANCEL),
  getPreferences: (): Promise<Preferences> => ipcRenderer.invoke(IPC.PREFERENCES_GET),
  setPreferences: (prefs: Partial<Preferences>): Promise<Preferences> =>
    ipcRenderer.invoke(IPC.PREFERENCES_SET, prefs),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
  getLastPtformatDebug: (): Promise<PtformatDebugRecord | null> =>
    ipcRenderer.invoke(IPC.PTFORMAT_DEBUG_GET),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  onExportProgress: (callback: (progress: ExportProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ExportProgressEvent) => {
      callback(progress)
    }
    ipcRenderer.on(IPC.EXPORT_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.EXPORT_PROGRESS, handler)
  },
}

contextBridge.exposeInMainWorld('prism', prismApi)
