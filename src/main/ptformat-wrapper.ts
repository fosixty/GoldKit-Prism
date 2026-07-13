import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { basename, dirname, extname, join, resolve } from 'path'
import {
  MAX_CHANNELS,
  MAX_DURATION_SAMPLES,
  MAX_PTFORMAT_STDOUT_BYTES,
  MAX_REGIONS_PER_TRACK,
  MAX_TRACKS,
  PTFORMAT_SPAWN_TIMEOUT_MS,
} from '../shared/security-limits'
import type { PtformatDebugRecord, SessionMetadata, SessionRegion, SessionTrack } from '../shared/types'
import { getExpectedPtformatBinaryPath, getPtformatBinaryPath } from './native-binaries'

type UnknownRecord = Record<string, unknown>

interface ParseContext {
  ptxPath: string
  sessionDir: string
}

let lastPtformatDebugRecord: PtformatDebugRecord | null = null

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function getSessionName(ptxPath: string): string {
  return basename(ptxPath, extname(ptxPath))
}

function getSessionDir(ptxPath: string): string {
  return dirname(resolve(ptxPath))
}

// Both ptformat.exe and ptx-json.exe hardcode targetsr=48000 when calling ptf.load().
// All position values they emit (startSamples, offsetSamples, lengthSamples) are therefore
// in 48000 Hz units regardless of the actual session sample rate. We correct for this here.
const PTFORMAT_HARDCODED_TARGET_RATE = 48000

function normalizeTrack(rawTrack: UnknownRecord, trackIndex: number, rateScale: number): SessionTrack {
  const rawRegions = asArray(rawTrack.regions)
  const regions: SessionRegion[] = rawRegions.map((rawRegion, regionIndex) => {
    const region = (rawRegion ?? {}) as UnknownRecord
    return {
      id: `track-${trackIndex}-region-${regionIndex}`,
      sourceFile: asString(region.sourceFile ?? region.audioFile ?? region.file, ''),
      startSamples: Math.round(asNumber(region.startSamples ?? region.start ?? region.startPos) * rateScale),
      lengthSamples: Math.round(asNumber(region.lengthSamples ?? region.length ?? region.durationSamples) * rateScale),
      offsetSamples: Math.round(asNumber(region.offsetSamples ?? region.offset ?? region.sourceOffset) * rateScale),
    }
  })

  return {
    id: `track-${trackIndex}`,
    name: asString(rawTrack.name, `Track ${trackIndex + 1}`),
    channels: Math.max(1, asNumber(rawTrack.channels ?? rawTrack.channelCount, 2)),
    regions,
  }
}

function assertNormalizedMetadataWithinLimits(metadata: SessionMetadata): void {
  if (metadata.tracks.length > MAX_TRACKS) {
    throw new Error(`Session exceeds maximum track count (${MAX_TRACKS}).`)
  }

  if (metadata.durationSamples > MAX_DURATION_SAMPLES) {
    throw new Error(`Session exceeds maximum duration (${MAX_DURATION_SAMPLES} samples).`)
  }

  for (const track of metadata.tracks) {
    if (track.channels > MAX_CHANNELS) {
      throw new Error(`Track "${track.name}" exceeds maximum channel count (${MAX_CHANNELS}).`)
    }

    if (track.regions.length > MAX_REGIONS_PER_TRACK) {
      throw new Error(
        `Track "${track.name}" exceeds maximum region count (${MAX_REGIONS_PER_TRACK}).`,
      )
    }
  }
}

export function normalizePtformatOutput(raw: unknown, context: ParseContext): SessionMetadata {
  const root = (raw ?? {}) as UnknownRecord
  const sampleRateRaw = asNumber(root.sampleRate ?? root.sessionRate, PTFORMAT_HARDCODED_TARGET_RATE)
  const rateScale = sampleRateRaw > 0 ? sampleRateRaw / PTFORMAT_HARDCODED_TARGET_RATE : 1
  const tracks = asArray(root.tracks)
    .filter((track) => asString((track as UnknownRecord).type, 'audio') !== 'midi')
    .map((track, index) => normalizeTrack((track ?? {}) as UnknownRecord, index, rateScale))

  const durationFromTrackEnds = tracks.reduce((max, track) => {
    const trackEnd = track.regions.reduce((tMax, region) => {
      const end = region.startSamples + region.lengthSamples
      return end > tMax ? end : tMax
    }, 0)
    return trackEnd > max ? trackEnd : max
  }, 0)

  const sampleRate = sampleRateRaw
  const durationSamples = Math.max(
    durationFromTrackEnds,
    Math.round(asNumber(root.durationSamples ?? root.lengthSamples, 0) * rateScale),
  )

  const metadata: SessionMetadata = {
    sessionName: asString(root.sessionName, getSessionName(context.ptxPath)),
    sessionPath: context.ptxPath,
    sessionDir: context.sessionDir,
    sampleRate,
    bitDepth: asNumber(root.bitDepth, 24),
    durationSamples,
    durationSeconds: sampleRate > 0 ? durationSamples / sampleRate : 0,
    tracks,
    totalTracks: tracks.length,
  }

  assertNormalizedMetadataWithinLimits(metadata)
  return metadata
}

function parsePtformatTextOutput(output: string, context: ParseContext): SessionMetadata | null {
  const lines = output.split(/\r?\n/)

  // Session sample rate (e.g. "ProTools 12 Session: Samplerate = 44100Hz")
  const sampleRateLine = lines.find((line) => /^\s*ProTools.*Samplerate\s*=\s*\d+Hz/i.test(line))
  const sampleRateMatch = sampleRateLine?.match(/Samplerate\s*=\s*(\d+)Hz/i)
  const sampleRate = sampleRateMatch ? Number.parseInt(sampleRateMatch[1], 10) : PTFORMAT_HARDCODED_TARGET_RATE

  // ptformat.exe always loads with targetsr=48000; all emitted positions are in those units.
  // Parse the "Target samplerate = NNNN" line (present in ptftool output) to confirm the rate,
  // then scale every position value to the actual session rate.
  const targetRateLine = lines.find((line) => line.includes('Target samplerate'))
  const targetRateMatch = targetRateLine?.match(/Target samplerate\s*[=:]\s*(\d+)/i)
  const ptformatTargetRate = targetRateMatch
    ? Number.parseInt(targetRateMatch[1], 10)
    : PTFORMAT_HARDCODED_TARGET_RATE
  const rateScale = sampleRate > 0 && ptformatTargetRate > 0 ? sampleRate / ptformatTargetRate : 1

  const trackByName = new Map<string, SessionTrack>()
  const regionRegex =
    /`([^`]+)`\s+t\(\d+\)\s+\(([^)]+)\)\s+@\s+(\d+)\s+\+\s+(\d+),\s+(\d+)/i

  for (const line of lines) {
    const match = line.match(regionRegex)
    if (!match) continue

    const trackName = match[1]?.trim() || 'Track'
    const sourceFile = match[2]?.trim() || ''
    const startSamples = Math.round((asInt(match[3] ?? '') ?? 0) * rateScale)
    const offsetSamples = Math.round((asInt(match[4] ?? '') ?? 0) * rateScale)
    const lengthSamples = Math.round((asInt(match[5] ?? '') ?? 0) * rateScale)

    const track =
      trackByName.get(trackName) ??
      ({
        id: `track-${trackByName.size}`,
        name: trackName,
        channels: 2,
        regions: [],
      } satisfies SessionTrack)

    track.regions.push({
      id: `${track.id}-region-${track.regions.length}`,
      sourceFile,
      startSamples,
      offsetSamples,
      lengthSamples,
    })
    trackByName.set(trackName, track)
  }

  const tracks = Array.from(trackByName.values())
  if (tracks.length === 0) {
    return null
  }

  const durationFromTrackEnds = tracks.reduce((max, track) => {
    const trackEnd = track.regions.reduce((tMax, region) => {
      const end = region.startSamples + region.lengthSamples
      return end > tMax ? end : tMax
    }, 0)
    return trackEnd > max ? trackEnd : max
  }, 0)

  const metadata: SessionMetadata = {
    sessionName: getSessionName(context.ptxPath),
    sessionPath: context.ptxPath,
    sessionDir: context.sessionDir,
    sampleRate,
    bitDepth: 24,
    durationSamples: durationFromTrackEnds,
    durationSeconds: sampleRate > 0 ? durationFromTrackEnds / sampleRate : 0,
    tracks,
    totalTracks: tracks.length,
    parseMode: 'aligned',
  }

  assertNormalizedMetadataWithinLimits(metadata)
  return metadata
}

function createDebugRecord(params: {
  binaryPath: string
  args: string[]
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  parseMode: 'json' | 'text' | 'none'
}): PtformatDebugRecord {
  return {
    timestamp: new Date().toISOString(),
    binaryPath: params.binaryPath,
    binaryExists: existsSync(params.binaryPath),
    args: params.args,
    cwd: params.cwd,
    exitCode: params.exitCode,
    stdout: params.stdout,
    stderr: params.stderr,
    parseMode: params.parseMode,
  }
}

function logPtformatDebug(record: PtformatDebugRecord): void {
  const command = `"${record.binaryPath}" ${record.args.map((a) => JSON.stringify(a)).join(' ')}`
  console.error('[ptformat] command:', command)
  console.error('[ptformat] cwd:', record.cwd)
  console.error('[ptformat] binaryExists:', record.binaryExists)
  console.error('[ptformat] exitCode:', record.exitCode)
  console.error('[ptformat] parseMode:', record.parseMode)
  console.error('[ptformat] stdout:', record.stdout)
  console.error('[ptformat] stderr:', record.stderr)
}

function shouldLogSuccessDebug(): boolean {
  return process.env.PTFORMAT_DEBUG === '1'
}

export function getLastPtformatDebugRecord(): PtformatDebugRecord | null {
  return lastPtformatDebugRecord
}

export async function parseSessionWithPtformat(ptxPath: string): Promise<SessionMetadata> {
  const sessionPath = resolve(ptxPath)
  const sessionDir = getSessionDir(sessionPath)
  const args = [sessionPath]

  let binaryPath: string
  try {
    binaryPath = getPtformatBinaryPath()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const missingBinaryPath = getExpectedPtformatBinaryPath()
    lastPtformatDebugRecord = createDebugRecord({
      binaryPath: missingBinaryPath,
      args,
      cwd: sessionDir,
      exitCode: null,
      stdout: '',
      stderr: message,
      parseMode: 'none',
    })
    logPtformatDebug(lastPtformatDebugRecord)
    throw err
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binaryPath, args, {
      windowsHide: true,
      cwd: sessionDir,
    })

    let stdout = ''
    let stdoutBytes = 0
    let stderr = ''
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, PTFORMAT_SPAWN_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length
      if (stdoutBytes > MAX_PTFORMAT_STDOUT_BYTES) {
        child.kill()
        return
      }
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      lastPtformatDebugRecord = createDebugRecord({
        binaryPath,
        args,
        cwd: sessionDir,
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${err.message}`.trim(),
        parseMode: 'none',
      })
      logPtformatDebug(lastPtformatDebugRecord)
      rejectPromise(new Error(`ptformat launch failed: ${err.message}`))
    })

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (timedOut) {
        lastPtformatDebugRecord = createDebugRecord({
          binaryPath,
          args,
          cwd: sessionDir,
          exitCode: code,
          stdout,
          stderr,
          parseMode: 'none',
        })
        logPtformatDebug(lastPtformatDebugRecord)
        rejectPromise(new Error('ptformat timed out while parsing the session.'))
        return
      }

      if (stdoutBytes > MAX_PTFORMAT_STDOUT_BYTES) {
        lastPtformatDebugRecord = createDebugRecord({
          binaryPath,
          args,
          cwd: sessionDir,
          exitCode: code,
          stdout,
          stderr,
          parseMode: 'none',
        })
        logPtformatDebug(lastPtformatDebugRecord)
        rejectPromise(new Error('ptformat output exceeded the maximum allowed size.'))
        return
      }

      if (code !== 0) {
        lastPtformatDebugRecord = createDebugRecord({
          binaryPath,
          args,
          cwd: sessionDir,
          exitCode: code,
          stdout,
          stderr,
          parseMode: 'none',
        })
        logPtformatDebug(lastPtformatDebugRecord)
        rejectPromise(new Error('ptformat failed to parse this session. See logs for details.'))
        return
      }

      const trimmedStdout = stdout.trim()
      if (trimmedStdout.startsWith('{')) {
        try {
          const raw = JSON.parse(trimmedStdout)
          const metadata = normalizePtformatOutput(raw, { ptxPath: sessionPath, sessionDir })
          lastPtformatDebugRecord = createDebugRecord({
            binaryPath,
            args,
            cwd: sessionDir,
            exitCode: code,
            stdout,
            stderr,
            parseMode: 'json',
          })
          if (shouldLogSuccessDebug()) {
            logPtformatDebug(lastPtformatDebugRecord)
          }
          resolvePromise(metadata)
          return
        } catch {
          // fall through to text parsing
        }
      }

      const textMetadata = parsePtformatTextOutput(stdout, { ptxPath: sessionPath, sessionDir })
      if (textMetadata) {
        lastPtformatDebugRecord = createDebugRecord({
          binaryPath,
          args,
          cwd: sessionDir,
          exitCode: code,
          stdout,
          stderr,
          parseMode: 'text',
        })
        if (shouldLogSuccessDebug()) {
          logPtformatDebug(lastPtformatDebugRecord)
        }
        resolvePromise(textMetadata)
        return
      }

      lastPtformatDebugRecord = createDebugRecord({
        binaryPath,
        args,
        cwd: sessionDir,
        exitCode: code,
        stdout,
        stderr,
        parseMode: 'none',
      })
      logPtformatDebug(lastPtformatDebugRecord)
      rejectPromise(new Error('ptformat failed to parse this session. See logs for details.'))
    })
  })
}
