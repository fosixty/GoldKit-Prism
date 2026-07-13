import { open, readFile, stat } from 'fs/promises'
import { statSync, writeFileSync } from 'fs'
import wavefile from 'wavefile'
import { MAX_WAV_FILE_BYTES } from '../../shared/security-limits'

const { WaveFile } = wavefile

export interface WavAudioData {
  sampleRate: number
  numberOfChannels: number
  length: number
  channelData: Float32Array[]
}

function readUInt32LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset)
}

function findFmtSampleRate(header: Buffer): number | null {
  if (header.length < 12 || header.toString('ascii', 0, 4) !== 'RIFF') {
    return null
  }

  let offset = 12
  while (offset + 8 <= header.length) {
    const chunkId = header.toString('ascii', offset, offset + 4)
    const chunkSize = readUInt32LE(header, offset + 4)
    const chunkDataStart = offset + 8

    if (chunkId === 'fmt ' && chunkDataStart + 16 <= header.length) {
      return readUInt32LE(header, chunkDataStart + 4)
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2)
  }

  return null
}

export async function readWavSampleRate(path: string): Promise<number> {
  const fileStats = await stat(path)
  if (fileStats.size > MAX_WAV_FILE_BYTES) {
    throw new Error(`WAV file exceeds maximum allowed size (${MAX_WAV_FILE_BYTES} bytes).`)
  }

  const handle = await open(path, 'r')
  try {
    const header = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    const sampleRate = findFmtSampleRate(header.subarray(0, bytesRead))
    if (!sampleRate || sampleRate <= 0) {
      throw new Error('Could not read WAV sample rate from file header.')
    }
    return sampleRate
  } finally {
    await handle.close()
  }
}

export async function readWavFile(path: string): Promise<WavAudioData> {
  const fileStats = statSync(path)
  if (fileStats.size > MAX_WAV_FILE_BYTES) {
    throw new Error(`WAV file exceeds maximum allowed size (${MAX_WAV_FILE_BYTES} bytes).`)
  }

  const bytes = await readFile(path)
  const wav = new WaveFile(bytes)
  wav.toBitDepth('32f')

  const sampleRate = Number(wav.fmt.sampleRate)
  const channelCount = Number(wav.fmt.numChannels)
  const rawSamples = wav.getSamples(false, Float32Array)
  const samples: Float32Array[] = Array.isArray(rawSamples)
    ? (rawSamples as Float32Array[])
    : [rawSamples as unknown as Float32Array]
  const length = samples[0]?.length ?? 0

  const channelData: Float32Array[] = []

  for (let channel = 0; channel < channelCount; channel += 1) {
    const source = samples[channel] ?? new Float32Array(length)
    const channelBuffer = new Float32Array(length)
    channelBuffer.set(source.subarray(0, length))
    channelData.push(channelBuffer)
  }

  return {
    sampleRate,
    numberOfChannels: channelCount,
    length,
    channelData,
  }
}

export function writeWavFile(path: string, buffer: WavAudioData): void {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.channelData[channel] ?? new Float32Array(buffer.length))
  }

  const wav = new WaveFile()
  wav.fromScratch(buffer.numberOfChannels, buffer.sampleRate, '32f', channels)
  wav.toBitDepth('24')

  writeFileSync(path, wav.toBuffer())
}
