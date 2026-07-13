import { resolve } from 'path'
import type { SessionMetadata } from '../shared/types'

const sessionCache = new Map<string, SessionMetadata>()

function cacheKey(sessionPath: string): string {
  return resolve(sessionPath)
}

export function cacheSessionMetadata(metadata: SessionMetadata): void {
  sessionCache.set(cacheKey(metadata.sessionPath), metadata)
}

export function getCachedSessionMetadata(sessionPath: string): SessionMetadata {
  const metadata = sessionCache.get(cacheKey(sessionPath))
  if (!metadata) {
    throw new Error('Session is not loaded. Parse the session before exporting.')
  }
  return metadata
}

export function clearSessionCache(): void {
  sessionCache.clear()
}
