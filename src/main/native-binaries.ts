import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

export function getPtformatResourceDir(): string {
  if (process.platform === 'win32') return 'win32'

  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      const roots = [
        join(process.resourcesPath, 'ptformat'),
        join(process.cwd(), 'resources', 'ptformat'),
      ]
      for (const root of roots) {
        if (existsSync(join(root, 'darwin-arm64', 'ptformat'))) {
          return 'darwin-arm64'
        }
      }
      return 'darwin-x64'
    }
    return 'darwin-x64'
  }

  return 'linux-x64'
}

export function getNativeBinaryCandidates(
  segments: string[],
  options?: { includeDevPaths?: boolean },
): string[] {
  const includeDevPaths = options?.includeDevPaths ?? !app.isPackaged
  const candidates = [join(process.resourcesPath, ...segments)]

  if (includeDevPaths) {
    candidates.push(
      join(process.cwd(), 'resources', ...segments),
      join(app.getAppPath(), '..', 'resources', ...segments),
      join(app.getAppPath(), 'resources', ...segments),
    )
  }

  return candidates
}

export function resolveNativeBinaryPath(
  resourceCategory: string,
  resourceDir: string,
  binaryName: string,
  extraDevCandidates: string[] = [],
): string {
  const segments = [resourceCategory, resourceDir, binaryName]
  const candidates = [
    ...getNativeBinaryCandidates(segments),
    ...extraDevCandidates.filter((candidate) => existsSync(candidate)),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    `${binaryName} not found under ${resourceCategory}/${resourceDir}. Timeline alignment is unavailable.`,
  )
}

export function getPtformatBinaryName(): string {
  return process.platform === 'win32' ? 'ptformat.exe' : 'ptformat'
}

export function getPtformatBinaryPath(): string {
  const resourceDir = getPtformatResourceDir()
  return resolveNativeBinaryPath('ptformat', resourceDir, getPtformatBinaryName())
}

export function getExpectedPtformatBinaryPath(): string {
  const resourceDir = getPtformatResourceDir()
  return join(process.resourcesPath, 'ptformat', resourceDir, getPtformatBinaryName())
}
