import { spawn } from 'child_process'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { PTFORMAT_SPAWN_TIMEOUT_MS } from '../shared/security-limits'
import type { SessionMetadata } from '../shared/types'
import { normalizePtformatOutput } from './ptformat-wrapper'

function getPtxJsonBinaryPath(): string {
  const binary = process.platform === 'win32' ? 'ptx-json.exe' : 'ptx-json'

  const candidates = [
    join(process.resourcesPath, 'bin', binary),
    join(app.getAppPath(), '..', 'resources', 'bin', binary),
    join(app.getAppPath(), 'resources', 'bin', binary),
    join(process.cwd(), 'resources', 'bin', binary),
    join(process.cwd(), 'native', 'ptx-json', 'build', binary),
    join(process.cwd(), 'native', 'ptx-json', 'build', 'Release', binary),
    join(process.cwd(), 'native', 'ptx-json', 'build', 'Debug', binary),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error('ptx-json binary not found; timeline alignment fallback is unavailable.')
}

export async function parseSessionWithPtxJson(ptxPath: string): Promise<SessionMetadata> {
  const sessionPath = resolve(ptxPath)
  const binaryPath = getPtxJsonBinaryPath()
  const args = [sessionPath]

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binaryPath, args, {
      windowsHide: true,
      cwd: resolve(sessionPath, '..'),
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, PTFORMAT_SPAWN_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      rejectPromise(new Error(`ptx-json launch failed: ${err.message}`))
    })

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (timedOut) {
        rejectPromise(new Error('ptx-json timed out while parsing the session.'))
        return
      }

      if (code !== 0) {
        rejectPromise(
          new Error(`ptx-json failed with exit code ${code ?? 'null'}: ${stderr || stdout}`),
        )
        return
      }

      try {
        const raw = JSON.parse(stdout.trim())
        if (raw && typeof raw === 'object' && 'error' in raw) {
          rejectPromise(new Error(String((raw as { error: string }).error)))
          return
        }

        const sessionDir = resolve(sessionPath, '..')
        const metadata = normalizePtformatOutput(raw, { ptxPath: sessionPath, sessionDir })
        if (metadata.tracks.length === 0) {
          rejectPromise(new Error('ptx-json returned no audio tracks for this session.'))
          return
        }

        resolvePromise({
          ...metadata,
          parseMode: 'aligned',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        rejectPromise(new Error(`ptx-json output could not be parsed: ${message}`))
      }
    })
  })
}
