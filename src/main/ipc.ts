import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { GOLDKIT_URL, IPC } from '../shared/constants'
import type { ExportOptions, Preferences } from '../shared/types'
import { exportStems, validateSessionExport, cancelActiveExport } from './audio/exporter'
import { parsePtxFile } from './pro-tools/parser'
import { getLastPtformatDebugRecord } from './ptformat-wrapper'
import {
  assertAllowedOutputDir,
  registerAllowedOutputDir,
  registerAllowedPtxPath,
} from './security/allowlist'
import { assertTrustedSender } from './security/ipc-guard'
import { getCachedSessionMetadata } from './session-cache'
import { getPreferences, setPreferences } from './store'

function assertAllowedExternalUrl(url: string): void {
  if (url !== GOLDKIT_URL) {
    throw new Error('External URL is not allowed.')
  }
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.DIALOG_OPEN_PTX, async (event) => {
    assertTrustedSender(event, getMainWindow)
    const result = await dialog.showOpenDialog({
      title: 'Open Pro Tools Session',
      filters: [{ name: 'Pro Tools Session', extensions: ['ptx'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    registerAllowedPtxPath(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_OPEN_OUTPUT_DIR, async (event) => {
    assertTrustedSender(event, getMainWindow)
    const result = await dialog.showOpenDialog({
      title: 'Select Output Folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    registerAllowedOutputDir(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.PTX_PARSE, async (event, ptxPath: string) => {
    assertTrustedSender(event, getMainWindow)
    if (typeof ptxPath !== 'string' || !ptxPath.trim()) {
      throw new Error('Invalid PTX path.')
    }
    return parsePtxFile(ptxPath)
  })

  ipcMain.handle(IPC.EXPORT_VALIDATE, async (event, sessionPath: string) => {
    assertTrustedSender(event, getMainWindow)
    if (typeof sessionPath !== 'string' || !sessionPath.trim()) {
      throw new Error('Invalid session path.')
    }
    const metadata = getCachedSessionMetadata(sessionPath)
    return validateSessionExport(metadata)
  })

  ipcMain.handle(IPC.EXPORT_STEMS, async (event, sessionPath: string, options: ExportOptions) => {
    assertTrustedSender(event, getMainWindow)
    if (typeof sessionPath !== 'string' || !sessionPath.trim()) {
      throw new Error('Invalid session path.')
    }
    const win = getMainWindow()
    if (!win) throw new Error('No main window')
    const metadata = getCachedSessionMetadata(sessionPath)
    return exportStems(metadata, options, win.webContents)
  })

  ipcMain.handle(IPC.EXPORT_CANCEL, async (event) => {
    assertTrustedSender(event, getMainWindow)
    cancelActiveExport()
    return true
  })

  ipcMain.handle(IPC.PREFERENCES_GET, async (event) => {
    assertTrustedSender(event, getMainWindow)
    return getPreferences()
  })

  ipcMain.handle(IPC.PREFERENCES_SET, async (event, partial: Partial<Preferences>) => {
    assertTrustedSender(event, getMainWindow)
    return setPreferences(partial)
  })

  ipcMain.handle(IPC.OPEN_EXTERNAL, async (event, url: string) => {
    assertTrustedSender(event, getMainWindow)
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('Invalid external URL.')
    }
    assertAllowedExternalUrl(url)
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(IPC.PTFORMAT_DEBUG_GET, async (event) => {
    assertTrustedSender(event, getMainWindow)
    return getLastPtformatDebugRecord()
  })
}
