import { existsSync, realpathSync } from 'fs'
import { basename, dirname, extname, join, resolve, sep } from 'path'

const AUDIO_DIR_NAMES = ['Audio Files', 'AudioFiles', 'audio files', 'audiofiles']

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

export function getSessionDir(ptxPath: string, sessionDir?: string): string {
  if (sessionDir) return resolve(sessionDir)
  return dirname(resolve(ptxPath))
}

export function getSessionName(ptxPath: string): string {
  return basename(ptxPath, extname(ptxPath))
}

export function isPathContained(rootDir: string, candidatePath: string): boolean {
  const resolvedRoot = resolve(rootDir)
  const resolvedCandidate = resolve(candidatePath)
  const rootWithSep = resolvedRoot.endsWith(sep) ? resolvedRoot : `${resolvedRoot}${sep}`
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(rootWithSep)
}

function hasTraversalSegment(sourceFile: string): boolean {
  const normalized = sourceFile.replace(/\\/g, '/')
  return normalized.split('/').some((segment) => segment === '..')
}

function isContainedExistingPath(rootDir: string, candidatePath: string): boolean {
  if (!isPathContained(rootDir, candidatePath) || !existsSync(candidatePath)) {
    return false
  }

  try {
    const realRoot = realpathSync.native(rootDir)
    const realCandidate = realpathSync.native(candidatePath)
    return isPathContained(realRoot, realCandidate)
  } catch {
    return false
  }
}

export function resolveAudioPath(sessionDir: string, sourceFile: string): string | null {
  if (!sourceFile || hasTraversalSegment(sourceFile)) {
    return null
  }

  const normalized = sourceFile.replace(/\\/g, '/')
  const candidates = [
    resolve(sessionDir, normalized),
    resolve(sessionDir, basename(normalized)),
    ...AUDIO_DIR_NAMES.map((dir) => resolve(sessionDir, dir, basename(normalized))),
    ...AUDIO_DIR_NAMES.map((dir) => resolve(sessionDir, dir, normalized)),
  ]

  for (const candidate of candidates) {
    if (isContainedExistingPath(sessionDir, candidate)) {
      return candidate
    }
  }

  return null
}

function escapeReservedDeviceName(name: string): string {
  const base = name.split('.')[0]?.toUpperCase() ?? ''
  if (WINDOWS_RESERVED_NAMES.has(base)) {
    return `_${name}`
  }
  return name
}

export function sanitizeFilename(name: string, maxLength = 120): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
  if (!cleaned) return 'Untitled'
  return escapeReservedDeviceName(cleaned.slice(0, maxLength))
}

export function getStemFilename(sessionName: string, trackName: string): string {
  const safeSession = sanitizeFilename(sessionName)
  const safeTrack = sanitizeFilename(trackName)
  return `${safeSession}_${safeTrack}_STEM.wav`
}
