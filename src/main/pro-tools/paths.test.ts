import { describe, expect, it } from 'vitest'
import { isPathContained, resolveAudioPath, sanitizeFilename, getStemFilename } from './paths'

describe('paths', () => {
  it('sanitizes illegal filename characters', () => {
    expect(sanitizeFilename('Track: Dialogue/Main')).toBe('Track_ Dialogue_Main')
  })

  it('prefixes Windows reserved device names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON')
    expect(sanitizeFilename('NUL.wav')).toBe('_NUL.wav')
    expect(sanitizeFilename('COM1')).toBe('_COM1')
  })

  it('builds stem filename with session and track', () => {
    expect(getStemFilename('MySession', 'Dialogue')).toBe('MySession_Dialogue_STEM.wav')
  })

  it('rejects traversal segments in source files', () => {
    const sessionDir = 'C:\\Sessions\\MyProject'
    expect(resolveAudioPath(sessionDir, '../../../outside.wav')).toBeNull()
    expect(resolveAudioPath(sessionDir, 'Audio Files/../../outside.wav')).toBeNull()
  })

  it('checks path containment with trailing separator guard', () => {
    const root = 'C:\\Sessions\\MyProject'
    expect(isPathContained(root, 'C:\\Sessions\\MyProject\\Audio Files\\clip.wav')).toBe(true)
    expect(isPathContained(root, 'C:\\Sessions\\MyProjectEvil\\clip.wav')).toBe(false)
    expect(isPathContained(root, 'C:\\Sessions\\MyProject')).toBe(true)
  })
})
