import { existsSync, statSync } from 'fs'
import { resolve } from 'path'
import { LOG_LEVELS } from '../../shared/constants'
import type { LogLevel, Preferences } from '../../shared/types'
import { registerAllowedOutputDir } from './allowlist'

const ALLOWED_PREFERENCE_KEYS = new Set<keyof Preferences>([
  'defaultOutputDir',
  'autoOrganize',
  'logLevel',
  'windowBounds',
])

const MIN_WINDOW_DIMENSION = 400
const MAX_WINDOW_DIMENSION = 10000

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel)
}

function validateWindowBounds(bounds: unknown): Preferences['windowBounds'] | undefined {
  if (bounds === undefined) return undefined
  if (!bounds || typeof bounds !== 'object') {
    throw new Error('Invalid window bounds.')
  }

  const candidate = bounds as Record<string, unknown>
  const x = Number(candidate.x)
  const y = Number(candidate.y)
  const width = Number(candidate.width)
  const height = Number(candidate.height)

  if (![x, y, width, height].every(Number.isFinite)) {
    throw new Error('Invalid window bounds.')
  }

  return {
    x,
    y,
    width: Math.min(MAX_WINDOW_DIMENSION, Math.max(MIN_WINDOW_DIMENSION, width)),
    height: Math.min(MAX_WINDOW_DIMENSION, Math.max(MIN_WINDOW_DIMENSION, height)),
  }
}

function validateDefaultOutputDir(path: unknown): string {
  if (path === undefined || path === '') return ''
  if (typeof path !== 'string') {
    throw new Error('Invalid default output directory.')
  }

  const resolved = resolve(path)
  if (!existsSync(resolved)) {
    throw new Error('Default output directory does not exist.')
  }

  const stats = statSync(resolved)
  if (!stats.isDirectory()) {
    throw new Error('Default output directory must be a directory.')
  }

  registerAllowedOutputDir(resolved)
  return resolved
}

export function validatePreferencesPartial(partial: Partial<Preferences>): Partial<Preferences> {
  const validated: Partial<Preferences> = {}

  for (const [key, value] of Object.entries(partial)) {
    if (!ALLOWED_PREFERENCE_KEYS.has(key as keyof Preferences)) {
      throw new Error(`Unsupported preference key: ${key}`)
    }
  }

  if ('defaultOutputDir' in partial) {
    validated.defaultOutputDir = validateDefaultOutputDir(partial.defaultOutputDir)
  }

  if ('autoOrganize' in partial) {
    if (typeof partial.autoOrganize !== 'boolean') {
      throw new Error('Invalid autoOrganize preference.')
    }
    validated.autoOrganize = partial.autoOrganize
  }

  if ('logLevel' in partial) {
    if (!isLogLevel(partial.logLevel)) {
      throw new Error('Invalid log level preference.')
    }
    validated.logLevel = partial.logLevel
  }

  if ('windowBounds' in partial) {
    validated.windowBounds = validateWindowBounds(partial.windowBounds)
  }

  return validated
}
