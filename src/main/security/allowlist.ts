import { resolve } from 'path'

const allowedPtxPaths = new Set<string>()
const allowedOutputDirs = new Set<string>()

function normalizePath(path: string): string {
  return resolve(path)
}

export function registerAllowedPtxPath(path: string): void {
  allowedPtxPaths.add(normalizePath(path))
}

export function registerAllowedOutputDir(path: string): void {
  allowedOutputDirs.add(normalizePath(path))
}

export function assertAllowedPtxPath(path: string): void {
  if (!allowedPtxPaths.has(normalizePath(path))) {
    throw new Error('PTX path was not selected through the application.')
  }
}

export function assertAllowedOutputDir(path: string): void {
  if (!allowedOutputDirs.has(normalizePath(path))) {
    throw new Error('Output directory was not selected through the application.')
  }
}

export function clearAllowlists(): void {
  allowedPtxPaths.clear()
  allowedOutputDirs.clear()
}
