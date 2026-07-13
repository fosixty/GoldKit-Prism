import type { LogLevel, Preferences } from './types'

export const IPC = {
  DIALOG_OPEN_PTX: 'dialog:openPtx',
  DIALOG_OPEN_OUTPUT_DIR: 'dialog:openOutputDir',
  PTX_PARSE: 'ptx-parse',
  EXPORT_VALIDATE: 'export-validate',
  EXPORT_STEMS: 'export-stems',
  EXPORT_CANCEL: 'export:cancel',
  EXPORT_PROGRESS: 'export:progress',
  OPEN_EXTERNAL: 'open-external',
  PTFORMAT_DEBUG_GET: 'ptformat:debug:get',
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set',
} as const

export const DEFAULT_PREFERENCES: Preferences = {
  defaultOutputDir: '',
  autoOrganize: true,
  logLevel: 'info',
}

export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

export const GOLDKIT_URL = 'https://mitchellgendron.com/goldkit'

export const ABOUT_TEXT = {
  title: 'GoldKit / Prism',
  version: '1.0.0',
  description:
    'Extract raw audio stems from Pro Tools sessions without plugin or bus processing.',
  disclaimer:
    'Prism is an independent tool and is not affiliated with or endorsed by Avid Technology.',
}
