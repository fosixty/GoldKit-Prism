import { mkdir, stat } from 'fs/promises'
import { copyFileSync } from 'fs'
import { basename, extname, join } from 'path'
import type { WebContents } from 'electron'
import { IPC } from '../../shared/constants'
import {
  MAX_CHANNELS,
  MAX_CONCURRENT_EXPORTS,
  MAX_DURATION_SAMPLES,
  MAX_REGIONS_PER_TRACK,
  MAX_TRACKS,
} from '../../shared/security-limits'
import type {
  ExportOptions,
  ExportProgressEvent,
  ExportSummary,
  ExportValidationResult,
  SessionMetadata,
  SessionRegion,
  ValidationIssue,
} from '../../shared/types'
import { assertAllowedOutputDir } from '../security/allowlist'
import { getStemFilename, resolveAudioPath, sanitizeFilename } from '../pro-tools/paths'
import { readWavFile, readWavSampleRate, writeWavFile, type WavAudioData } from './wav-io'

const WAV_EXTENSIONS = new Set(['.wav', '.wave'])
const AIFF_EXTENSIONS = new Set(['.aif', '.aiff'])

let cancelled = false
let activeExportId: string | null = null
let activeExportCount = 0

function getEstimatedOutputBytes(metadata: SessionMetadata): number {
  return metadata.tracks.reduce((sum, track) => {
    const trackEnd = track.regions.reduce((max, region) => {
      const end = region.startSamples + region.lengthSamples
      return end > max ? end : max
    }, 0)
    const channels = Math.max(1, track.channels)
    return sum + trackEnd * channels * 3
  }, 0)
}

function getTrackEndSamples(track: SessionMetadata['tracks'][number]): number {
  return track.regions.reduce((max, region) => {
    const end = region.startSamples + region.lengthSamples
    return end > max ? end : max
  }, 0)
}

function trimTrackBuffer(buffer: WavAudioData, lengthSamples: number): WavAudioData {
  const trimmedLength = Math.max(1, Math.min(lengthSamples, buffer.length))
  return {
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    length: trimmedLength,
    channelData: buffer.channelData.map((channel) => channel.subarray(0, trimmedLength)),
  }
}

function extension(path: string): string {
  return extname(path).toLowerCase()
}

function issueFromRegion(
  trackName: string,
  region: SessionRegion,
  reason: ValidationIssue['reason'],
  message: string,
  expectedSampleRate?: number,
  actualSampleRate?: number,
): ValidationIssue {
  return {
    trackName,
    sourceFile: region.sourceFile,
    reason,
    message,
    expectedSampleRate,
    actualSampleRate,
  }
}

export function assertMetadataWithinLimits(metadata: SessionMetadata): void {
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

export async function validateSessionExport(
  metadata: SessionMetadata,
): Promise<ExportValidationResult> {
  assertMetadataWithinLimits(metadata)

  const missingFiles: ValidationIssue[] = []
  const sampleRateMismatches: ValidationIssue[] = []
  const unsupportedFormats: ValidationIssue[] = []
  const checkedFiles = new Map<
    string,
    { ok: true; sampleRate: number } | { ok: false; message: string }
  >()

  for (const track of metadata.tracks) {
    for (const region of track.regions) {
      const resolved = resolveAudioPath(metadata.sessionDir, region.sourceFile)
      if (!resolved) {
        missingFiles.push(
          issueFromRegion(
            track.name,
            region,
            'missing-file',
            `Missing source file: ${region.sourceFile}`,
          ),
        )
        continue
      }

      const ext = extension(resolved)
      if (AIFF_EXTENSIONS.has(ext)) {
        unsupportedFormats.push(
          issueFromRegion(
            track.name,
            region,
            'unsupported-format',
            `AIFF source is not supported in this phase: ${region.sourceFile}`,
          ),
        )
        continue
      }

      if (!WAV_EXTENSIONS.has(ext)) {
        unsupportedFormats.push(
          issueFromRegion(
            track.name,
            region,
            'unsupported-format',
            `Unsupported source format: ${region.sourceFile}`,
          ),
        )
        continue
      }

      let fileResult = checkedFiles.get(resolved)
      if (!fileResult) {
        await new Promise<void>((resolveImmediate) => setImmediate(resolveImmediate))
        try {
          const sampleRate = await readWavSampleRate(resolved)
          fileResult = { ok: true, sampleRate }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          fileResult = { ok: false, message }
        }
        checkedFiles.set(resolved, fileResult)
      }

      if (!fileResult.ok) {
        unsupportedFormats.push(
          issueFromRegion(
            track.name,
            region,
            'read-error',
            `Could not read source WAV: ${region.sourceFile} (${fileResult.message})`,
          ),
        )
        continue
      }

      if (fileResult.sampleRate !== metadata.sampleRate) {
        sampleRateMismatches.push(
          issueFromRegion(
            track.name,
            region,
            'sample-rate-mismatch',
            `Sample rate mismatch (${fileResult.sampleRate}Hz vs session ${metadata.sampleRate}Hz): ${region.sourceFile}`,
            metadata.sampleRate,
            fileResult.sampleRate,
          ),
        )
      }
    }
  }

  return {
    missingFiles,
    sampleRateMismatches,
    unsupportedFormats,
    estimatedOutputBytes: getEstimatedOutputBytes(metadata),
    canExport: metadata.tracks.length > 0,
  }
}

function sendProgress(webContents: WebContents, progress: ExportProgressEvent): void {
  webContents.send(IPC.EXPORT_PROGRESS, progress)
}

function createSilenceBuffer(sampleRate: number, channels: number, length: number): WavAudioData {
  const normalizedChannels = Math.max(1, channels)
  const normalizedLength = Math.max(1, length)
  const channelData = Array.from(
    { length: normalizedChannels },
    () => new Float32Array(normalizedLength),
  )

  return {
    sampleRate,
    numberOfChannels: normalizedChannels,
    length: normalizedLength,
    channelData,
  }
}

function copyRegionIntoTrackBuffer(
  destination: WavAudioData,
  source: WavAudioData,
  region: SessionRegion,
): void {
  const sourceChannels = source.numberOfChannels
  const destinationChannels = destination.numberOfChannels
  const copyLength = Math.max(
    0,
    Math.min(region.lengthSamples, source.length - region.offsetSamples, destination.length - region.startSamples),
  )

  if (copyLength <= 0) return

  for (let channel = 0; channel < destinationChannels; channel += 1) {
    const sourceChannel = Math.min(channel, sourceChannels - 1)
    const destinationData = destination.channelData[channel]
    const sourceData = source.channelData[sourceChannel]
    for (let i = 0; i < copyLength; i += 1) {
      destinationData[region.startSamples + i] = sourceData[region.offsetSamples + i]
    }
  }
}

function hasBlockingValidationIssues(validation: ExportValidationResult): boolean {
  return (
    validation.missingFiles.length > 0 ||
    validation.sampleRateMismatches.length > 0 ||
    validation.unsupportedFormats.length > 0
  )
}

function getUniqueFallbackFilename(usedNames: Set<string>, sourcePath: string): string {
  const base = sanitizeFilename(basename(sourcePath))
  if (!usedNames.has(base)) {
    usedNames.add(base)
    return base
  }

  const ext = extname(base)
  const stem = ext ? base.slice(0, -ext.length) : base
  let counter = 1
  while (true) {
    const candidate = `${stem}_${counter}${ext}`
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate)
      return candidate
    }
    counter += 1
  }
}

async function exportFallbackRawCopy(
  metadata: SessionMetadata,
  options: ExportOptions,
  webContents: WebContents,
): Promise<ExportSummary> {
  const sourceFiles = metadata.fallbackSourceFiles ?? []
  if (sourceFiles.length === 0) {
    throw new Error('No raw source audio files were discovered for fallback export.')
  }

  const start = Date.now()
  const warnings: string[] = [
    'Raw export copied source audio files without timeline alignment.',
  ]
  const errors: string[] = []
  let totalBytes = 0
  let exportedTracks = 0

  const outputBase = options.autoOrganize
    ? join(options.outputDir, sanitizeFilename(metadata.sessionName))
    : options.outputDir
  await mkdir(outputBase, { recursive: true })

  const usedNames = new Set<string>()

  for (let i = 0; i < sourceFiles.length; i += 1) {
    if (cancelled) break
    const sourcePath = sourceFiles[i]
    const outName = getUniqueFallbackFilename(usedNames, sourcePath)
    const destinationPath = join(outputBase, outName)

    sendProgress(webContents, {
      trackName: outName,
      status: 'in-progress',
      percentComplete: Math.round((i / Math.max(1, sourceFiles.length)) * 100),
      message: 'Copying source file...',
    })

    try {
      copyFileSync(sourcePath, destinationPath)
      const fileStats = await stat(destinationPath)
      totalBytes += fileStats.size
      exportedTracks += 1

      sendProgress(webContents, {
        trackName: outName,
        status: 'complete',
        percentComplete: Math.round(((i + 1) / Math.max(1, sourceFiles.length)) * 100),
        message: 'Source file copied',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${outName}: ${message}`)
      sendProgress(webContents, {
        trackName: outName,
        status: 'error',
        percentComplete: Math.round(((i + 1) / Math.max(1, sourceFiles.length)) * 100),
        message,
      })
    }
  }

  return {
    totalTracks: sourceFiles.length,
    exportedTracks,
    skippedRegions: 0,
    totalBytes,
    durationMs: Date.now() - start,
    warnings,
    errors,
  }
}

export function cancelActiveExport(exportId?: string): void {
  if (exportId && activeExportId !== exportId) {
    return
  }
  cancelled = true
}

export async function exportStems(
  metadata: SessionMetadata,
  options: ExportOptions,
  webContents: WebContents,
): Promise<ExportSummary> {
  if (activeExportCount >= MAX_CONCURRENT_EXPORTS) {
    throw new Error('Another export is already in progress.')
  }

  assertAllowedOutputDir(options.outputDir)

  // Raw export mode: copy discovered source audio files, independent of ptformat alignment.
  if (options.exportMode === 'raw') {
    return exportFallbackRawCopy(metadata, options, webContents)
  }

  if (metadata.parseMode === 'fallback-raw-copy' || !metadata.hasAlignment) {
    throw new Error('Timeline alignment is unavailable for this session. Use Raw export instead.')
  }

  assertMetadataWithinLimits(metadata)

  const validation = await validateSessionExport(metadata)
  if (!validation.canExport) {
    throw new Error('Session cannot be exported because no valid tracks were found.')
  }

  if (hasBlockingValidationIssues(validation) && !options.continueWithIssues) {
    throw new Error('Resolve or acknowledge validation warnings before export.')
  }

  const exportId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  activeExportId = exportId
  activeExportCount += 1
  cancelled = false

  const start = Date.now()
  const warnings: string[] = []
  const errors: string[] = []
  let totalBytes = 0
  let exportedTracks = 0
  let skippedRegions = 0

  try {
    const outputBase = options.autoOrganize
      ? join(options.outputDir, sanitizeFilename(metadata.sessionName))
      : options.outputDir
    await mkdir(outputBase, { recursive: true })

    for (let trackIndex = 0; trackIndex < metadata.tracks.length; trackIndex += 1) {
      if (cancelled || activeExportId !== exportId) break
      const track = metadata.tracks[trackIndex]
      const trackBuffer = createSilenceBuffer(
        metadata.sampleRate,
        track.channels,
        metadata.durationSamples,
      )

      sendProgress(webContents, {
        trackName: track.name,
        status: 'in-progress',
        percentComplete: Math.round((trackIndex / Math.max(1, metadata.totalTracks)) * 100),
        message: 'Exporting track...',
      })

      try {
        for (const region of track.regions) {
          const resolved = resolveAudioPath(metadata.sessionDir, region.sourceFile)
          if (!resolved) {
            skippedRegions += 1
            warnings.push(`⚠ Missing source: ${region.sourceFile} (${track.name})`)
            continue
          }

          if (!WAV_EXTENSIONS.has(extension(resolved))) {
            skippedRegions += 1
            warnings.push(`⚠ Unsupported source format: ${region.sourceFile} (${track.name})`)
            continue
          }

          const source = await readWavFile(resolved)
          if (source.sampleRate !== metadata.sampleRate) {
            skippedRegions += 1
            warnings.push(
              `⚠ Sample rate mismatch for ${region.sourceFile} (${source.sampleRate}Hz != ${metadata.sampleRate}Hz)`,
            )
            continue
          }

          copyRegionIntoTrackBuffer(trackBuffer, source, region)
        }

        const trimmedBuffer = trimTrackBuffer(trackBuffer, getTrackEndSamples(track))
        const stemPath = join(outputBase, getStemFilename(metadata.sessionName, track.name))
        writeWavFile(stemPath, trimmedBuffer)
        const fileStats = await stat(stemPath)
        totalBytes += fileStats.size
        exportedTracks += 1

        sendProgress(webContents, {
          trackName: track.name,
          status: 'complete',
          percentComplete: Math.round(((trackIndex + 1) / Math.max(1, metadata.totalTracks)) * 100),
          message: 'Track exported',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`${track.name}: ${message}`)
        sendProgress(webContents, {
          trackName: track.name,
          status: 'error',
          percentComplete: Math.round(((trackIndex + 1) / Math.max(1, metadata.totalTracks)) * 100),
          message,
        })
      }
    }
  } finally {
    activeExportCount = Math.max(0, activeExportCount - 1)
    if (activeExportId === exportId) {
      activeExportId = null
    }
  }

  return {
    totalTracks: metadata.totalTracks,
    exportedTracks,
    skippedRegions,
    totalBytes,
    durationMs: Date.now() - start,
    warnings,
    errors,
  }
}
