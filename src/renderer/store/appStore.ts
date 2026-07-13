import { create } from 'zustand'
import type {
  ExportOptions,
  ExportProgressEvent,
  ExportSummary,
  ExportValidationResult,
  LogLevel,
  ParseResult,
  Preferences,
  SessionMetadata,
} from '@shared/types'
import { DEFAULT_PREFERENCES } from '@shared/constants'

interface AppState {
  parseResult: ParseResult | null
  session: SessionMetadata | null
  parseWarnings: string[]
  isParsing: boolean
  parseError: string
  preferences: Preferences
  exportOptions: ExportOptions
  validation: ExportValidationResult | null
  isValidating: boolean
  progressEvents: ExportProgressEvent[]
  exportSummary: ExportSummary | null
  isExporting: boolean
  exportError: string
  showSettings: boolean
  logLevel: LogLevel
  setSession: (result: ParseResult | null) => void
  setParsing: (isParsing: boolean) => void
  setParseError: (error: string) => void
  setPreferences: (prefs: Preferences) => void
  setExportOptions: (options: Partial<ExportOptions>) => void
  setValidation: (validation: ExportValidationResult | null) => void
  setValidating: (isValidating: boolean) => void
  pushProgressEvent: (event: ExportProgressEvent) => void
  setExportSummary: (summary: ExportSummary | null) => void
  setExporting: (isExporting: boolean) => void
  setExportError: (error: string) => void
  setShowSettings: (show: boolean) => void
  setLogLevel: (level: LogLevel) => void
  resetExport: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  parseResult: null,
  session: null,
  parseWarnings: [],
  isParsing: false,
  parseError: '',
  preferences: DEFAULT_PREFERENCES,
  exportOptions: {
    outputDir: '',
    autoOrganize: DEFAULT_PREFERENCES.autoOrganize,
    continueWithIssues: false,
    exportMode: 'aligned',
  },
  validation: null,
  isValidating: false,
  progressEvents: [],
  exportSummary: null,
  isExporting: false,
  exportError: '',
  showSettings: false,
  logLevel: DEFAULT_PREFERENCES.logLevel,
  setSession: (result) =>
    set({
      parseResult: result,
      session: result?.metadata ?? null,
      parseWarnings: result?.warnings ?? [],
      parseError: '',
      validation: null,
      isValidating: false,
      exportOptions: {
        ...get().exportOptions,
        exportMode: result?.metadata.hasAlignment ? 'aligned' : 'raw',
      },
    }),
  setParsing: (isParsing) => set({ isParsing }),
  setParseError: (parseError) => set({ parseError }),
  setPreferences: (preferences) =>
    set({
      preferences,
      logLevel: preferences.logLevel,
      exportOptions: {
        ...get().exportOptions,
        outputDir: preferences.defaultOutputDir || get().exportOptions.outputDir,
        autoOrganize: preferences.autoOrganize,
      },
    }),
  setExportOptions: (options) =>
    set({ exportOptions: { ...get().exportOptions, ...options } }),
  setValidation: (validation) => set({ validation, isValidating: false }),
  setValidating: (isValidating) => set({ isValidating }),
  pushProgressEvent: (event) =>
    set({ progressEvents: [...get().progressEvents, event] }),
  setExportSummary: (exportSummary) => set({ exportSummary }),
  setExporting: (isExporting) => set({ isExporting }),
  setExportError: (exportError) => set({ exportError }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setLogLevel: (logLevel) => set({ logLevel }),
  resetExport: () =>
    set({
      progressEvents: [],
      exportSummary: null,
      exportError: '',
      isExporting: false,
    }),
}))
