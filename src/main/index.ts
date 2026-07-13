import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { registerIpcHandlers } from './ipc'
import { registerAllowedOutputDir } from './security/allowlist'
import { getPreferences, setPreferences } from './store'

let mainWindow: BrowserWindow | null = null

function isAllowedDevRendererUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    )
  } catch {
    return false
  }
}

function registerTrustedPreferencePaths(): void {
  const prefs = getPreferences()
  if (prefs.defaultOutputDir) {
    const resolved = resolve(prefs.defaultOutputDir)
    if (existsSync(resolved)) {
      registerAllowedOutputDir(resolved)
    }
  }
}

function hardenWebContents(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (process.env.ELECTRON_RENDERER_URL) {
      if (!isAllowedDevRendererUrl(url)) {
        event.preventDefault()
      }
      return
    }

    if (!url.startsWith('file://')) {
      event.preventDefault()
    }
  })
}

function getAppIcon(): Electron.NativeImage | undefined {
  const candidates = [
    join(process.resourcesPath, 'icon.ico'),
    join(__dirname, '..', '..', 'build', 'icon.ico'),
    join(app.getAppPath(), 'build', 'icon.ico'),
    join(app.getAppPath(), '..', 'build', 'icon.ico'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return nativeImage.createFromPath(candidate)
    }
  }
  return undefined
}

function createWindow(): void {
  const prefs = getPreferences()
  const bounds = prefs.windowBounds ?? { width: 1100, height: 800 }
  const icon = getAppIcon()

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    title: 'GoldKit / Prism',
    backgroundColor: '#1a1a1a',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  hardenWebContents(mainWindow)

  mainWindow.on('close', () => {
    if (mainWindow) {
      const { x, y, width, height } = mainWindow.getBounds()
      setPreferences({ windowBounds: { x, y, width, height } })
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    if (!isAllowedDevRendererUrl(process.env.ELECTRON_RENDERER_URL)) {
      throw new Error('ELECTRON_RENDERER_URL must point to localhost or 127.0.0.1.')
    }
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerTrustedPreferencePaths()
  registerIpcHandlers(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
