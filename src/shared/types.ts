export type RegionSkipReason =
  | 'missing-file'
  | 'unsupported-format'
  | 'sample-rate-mismatch'
  | 'read-error'

export interface SessionRegion {
  id: string
  sourceFile: string
  startSamples: number
  lengthSamples: number
  offsetSamples: number
}

export interface SessionTrack {
  id: string
  name: string
  channels: number
  regions: SessionRegion[]
}

export interface SessionMetadata {
  sessionName: string
  sessionPath: string
  sessionDir: string
  durationSamples: number
  durationSeconds: number
  sampleRate: number
  bitDepth: number
  tracks: SessionTrack[]
  totalTracks: number
  parseMode?: 'aligned' | 'fallback-raw-copy'
  fallbackSourceFiles?: string[]
  hasAlignment?: boolean
}

export interface ParseResult {
  metadata: SessionMetadata
  warnings: string[]
  fallbackAvailable?: boolean
  parseErrorMessage?: string
  alignmentAvailable?: boolean
  alignmentWarning?: string
}

export interface PtformatDebugRecord {
  timestamp: string
  binaryPath: string
  binaryExists: boolean
  args: string[]
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  parseMode: 'json' | 'text' | 'none'
}

export interface ValidationIssue {
  trackName: string
  sourceFile: string
  reason: RegionSkipReason
  message: string
  expectedSampleRate?: number
  actualSampleRate?: number
}

export interface ExportValidationResult {
  missingFiles: ValidationIssue[]
  sampleRateMismatches: ValidationIssue[]
  unsupportedFormats: ValidationIssue[]
  estimatedOutputBytes: number
  canExport: boolean
}

export interface ExportOptions {
  outputDir: string
  autoOrganize: boolean
  continueWithIssues: boolean
  exportMode: 'raw' | 'aligned'
}

export type ExportStatus = 'in-progress' | 'complete' | 'error'

export interface ExportProgressEvent {
  trackName: string
  status: ExportStatus
  percentComplete: number
  message: string
}

export interface ExportSummary {
  totalTracks: number
  exportedTracks: number
  skippedRegions: number
  totalBytes: number
  durationMs: number
  warnings: string[]
  errors: string[]
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Preferences {
  defaultOutputDir: string
  autoOrganize: boolean
  logLevel: LogLevel
  windowBounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface PrismApi {
  openPtxFile: () => Promise<string | null>
  openOutputDir: () => Promise<string | null>
  ptxParse: (ptxPath: string) => Promise<ParseResult>
  exportValidate: (sessionPath: string) => Promise<ExportValidationResult>
  exportStems: (sessionPath: string, options: ExportOptions) => Promise<ExportSummary>
  cancelExport: () => Promise<boolean>
  getPreferences: () => Promise<Preferences>
  setPreferences: (prefs: Partial<Preferences>) => Promise<Preferences>
  openExternal: (url: string) => Promise<boolean>
  getLastPtformatDebug: () => Promise<PtformatDebugRecord | null>
  getPathForFile: (file: File) => string
  onExportProgress: (callback: (progress: ExportProgressEvent) => void) => () => void
}

declare global {
  interface Window {
    prism: PrismApi
  }
}
