import { existsSync, readdirSync } from 'fs'
import { dirname, extname, join, resolve } from 'path'
import type { ParseResult, SessionMetadata } from '../../shared/types'
import { registerAllowedPtxPath } from '../security/allowlist'
import { cacheSessionMetadata } from '../session-cache'
import { parseSessionWithPtformat } from '../ptformat-wrapper'
import { parseSessionWithPtxJson } from '../ptx-json-wrapper'

const AUDIO_DIR_NAMES = ['Audio Files', 'AudioFiles', 'audio files', 'audiofiles']
const RAW_AUDIO_EXTENSIONS = new Set(['.wav', '.wave', '.aif', '.aiff'])

function discoverRawAudioFiles(sessionDir: string): string[] {
  const discovered = new Set<string>()

  for (const dirName of AUDIO_DIR_NAMES) {
    const audioDir = join(sessionDir, dirName)
    if (!existsSync(audioDir)) continue

    let entries: string[] = []
    try {
      entries = readdirSync(audioDir)
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = join(audioDir, entry)
      const ext = extname(entry).toLowerCase()
      if (RAW_AUDIO_EXTENSIONS.has(ext) && existsSync(fullPath)) {
        discovered.add(fullPath)
      }
    }
  }

  return Array.from(discovered)
}

async function parseTimelineMetadata(ptxPath: string): Promise<SessionMetadata> {
  try {
    return await parseSessionWithPtxJson(ptxPath)
  } catch {
    return await parseSessionWithPtformat(ptxPath)
  }
}

export async function parsePtxFile(ptxPath: string): Promise<ParseResult> {
  if (extname(ptxPath).toLowerCase() !== '.ptx') {
    throw new Error('File must be a .ptx session')
  }

  const resolvedPath = resolve(ptxPath)
  if (!existsSync(resolvedPath)) {
    throw new Error('Session file not found')
  }

  registerAllowedPtxPath(resolvedPath)
  const sessionDir = dirname(resolvedPath)
  const fallbackSourceFiles = discoverRawAudioFiles(sessionDir)

  // Base metadata that does NOT depend on ptformat
  const baseMetadata = {
    sessionName: resolvedPath.split(/[\\/]/).pop()?.replace(/\.ptx$/i, '') ?? 'Session',
    sessionPath: resolvedPath,
    sessionDir,
    durationSamples: 0,
    durationSeconds: 0,
    sampleRate: 48000,
    bitDepth: 24,
    tracks: [],
    totalTracks: 0,
    parseMode: 'fallback-raw-copy' as const,
    fallbackSourceFiles,
    hasAlignment: false,
  }

  try {
    const ptformatMetadata = await parseTimelineMetadata(resolvedPath)
    const metadata = {
      ...ptformatMetadata,
      parseMode: 'aligned' as const,
      fallbackSourceFiles,
      hasAlignment: true,
    }
    cacheSessionMetadata(metadata)

    return {
      metadata,
      warnings: [],
      fallbackAvailable: fallbackSourceFiles.length > 0,
      alignmentAvailable: true,
    }
  } catch {
    const alignmentWarning =
      'Timeline alignment unavailable. Fallback raw export is still available.'
    cacheSessionMetadata(baseMetadata)
    return {
      metadata: baseMetadata,
      warnings: [alignmentWarning],
      fallbackAvailable: fallbackSourceFiles.length > 0,
      parseErrorMessage: alignmentWarning,
      alignmentAvailable: false,
      alignmentWarning,
    }
  }
}
