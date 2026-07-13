import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

export function assertTrustedSender(
  event: IpcMainInvokeEvent,
  getMainWindow: () => BrowserWindow | null,
): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized IPC sender.')
  }
}
