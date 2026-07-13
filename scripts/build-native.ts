import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { execSync, spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resourceRoot = join(root, 'resources', 'ptformat')
const resourcesBin = join(root, 'resources', 'bin')
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
const platformDir = join(resourceRoot, platform)

const EXPECTED_BINARIES: Record<string, string[]> = {
  win32: ['ptformat.exe'],
  darwin: ['ptformat'],
  linux: ['ptformat'],
}

// Runtime DLLs ptformat.exe needs (MSYS2 UCRT64 build). See scripts/copy-ptformat-dlls.ts.
const REQUIRED_WIN32_DLLS = [
  'libgcc_s_seh-1.dll',
  'libglib-2.0-0.dll',
  'libstdc++-6.dll',
  'libwinpthread-1.dll',
  'libintl-8.dll',
  'libiconv-2.dll',
  'libpcre2-8-0.dll',
]

// Windows STATUS_DLL_NOT_FOUND / STATUS_INVALID_IMAGE_FORMAT, surfaced as negative
// process exit codes when a native binary fails to load its dependencies.
const STATUS_DLL_NOT_FOUND = -1073741515
const STATUS_INVALID_IMAGE_FORMAT = -1073741701

function verifyBinaryDirectory(): void {
  mkdirSync(platformDir, { recursive: true })
  const expected = EXPECTED_BINARIES[platform] ?? []
  const existing = readdirSync(platformDir)

  if (existing.length === 0 || existing.every((name) => name === '.gitkeep')) {
    throw new Error(
      `No ptformat binary found in ${platformDir}. Place one of: ${expected.join(', ')} before packaging.`,
    )
  }

  const found = expected.some((name) => existsSync(join(platformDir, name)))
  if (!found) {
    throw new Error(
      `ptformat binary missing for ${platform}. Expected one of: ${expected.join(', ')} in ${platformDir}`,
    )
  }
}

function verifyWin32Runtime(): void {
  if (platform !== 'win32') return

  const missingDlls = REQUIRED_WIN32_DLLS.filter((dll) => !existsSync(join(platformDir, dll)))
  if (missingDlls.length > 0) {
    throw new Error(
      `ptformat.exe is missing required runtime DLLs in ${platformDir}: ${missingDlls.join(', ')}. ` +
        'Run `npm run copy:ptformat-dlls` to regenerate them from your MSYS2 UCRT64 install.',
    )
  }

  const exePath = join(platformDir, 'ptformat.exe')
  const result = spawnSync(exePath, [], {
    cwd: platformDir,
    windowsHide: true,
    timeout: 5000,
  })

  if (result.error) {
    throw new Error(`Failed to launch ptformat.exe for a runtime smoke test: ${result.error.message}`)
  }

  if (result.status === STATUS_DLL_NOT_FOUND) {
    throw new Error(
      `ptformat.exe failed to start (STATUS_DLL_NOT_FOUND). It is missing one or more runtime DLLs in ${platformDir}. ` +
        'Run `npm run copy:ptformat-dlls` to regenerate them.',
    )
  }

  if (result.status === STATUS_INVALID_IMAGE_FORMAT) {
    throw new Error(
      `ptformat.exe failed to start (STATUS_INVALID_IMAGE_FORMAT). The bundled DLLs in ${platformDir} may be the wrong architecture.`,
    )
  }
}

function verifyWin32Hashes(): void {
  if (platform !== 'win32') return

  const manifestPath = join(__dirname, 'ptformat-hashes.json')
  const requireHashes = process.env.VERIFY_PTFORMAT_HASHES === '1'

  if (!existsSync(manifestPath)) {
    if (requireHashes) {
      throw new Error('ptformat hash manifest is missing at scripts/ptformat-hashes.json')
    }
    console.warn('build-native: skipping ptformat hash verification (manifest not found).')
    return
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>
  const mismatches: string[] = []

  for (const [fileName, expectedHash] of Object.entries(manifest)) {
    const filePath = join(platformDir, fileName)
    if (!existsSync(filePath)) {
      mismatches.push(`${fileName}: missing`)
      continue
    }

    const actualHash = createHash('sha256').update(readFileSync(filePath)).digest('hex')
    if (actualHash !== expectedHash) {
      mismatches.push(`${fileName}: expected ${expectedHash}, got ${actualHash}`)
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`ptformat binary hash verification failed:\n${mismatches.join('\n')}`)
  }
}

function commandExists(command: string): boolean {
  try {
    execSync(process.platform === 'win32' ? `where ${command}` : `command -v ${command}`, {
      stdio: 'ignore',
      shell: true,
    })
    return true
  } catch {
    return false
  }
}

function findCmake(): string | null {
  const candidates = [
    'cmake',
    'C:\\Program Files\\CMake\\bin\\cmake.exe',
    'C:\\Program Files (x86)\\CMake\\bin\\cmake.exe',
  ]
  for (const candidate of candidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (existsSync(candidate)) return candidate
    } else if (commandExists(candidate)) {
      return candidate
    }
  }
  return null
}

function findBuiltPtxJson(buildDir: string, binaryName: string): string | null {
  const candidates = [
    join(buildDir, binaryName),
    join(buildDir, 'Release', binaryName),
    join(buildDir, 'Debug', binaryName),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function buildPtxJson(): void {
  const binaryName = platform === 'win32' ? 'ptx-json.exe' : 'ptx-json'
  const installedPath = join(resourcesBin, binaryName)
  if (existsSync(installedPath)) {
    console.log(`build-native: using existing ${installedPath}`)
    return
  }

  const nativeDir = join(root, 'native', 'ptx-json')
  const buildDir = join(nativeDir, 'build')
  const existingBuilt = findBuiltPtxJson(buildDir, binaryName)
  if (existingBuilt) {
    mkdirSync(resourcesBin, { recursive: true })
    execSync(
      process.platform === 'win32'
        ? `copy /Y "${existingBuilt}" "${installedPath}"`
        : `cp "${existingBuilt}" "${installedPath}"`,
      { stdio: 'inherit', shell: true },
    )
    console.log(`build-native: copied ${existingBuilt} -> ${installedPath}`)
    return
  }

  const cmake = findCmake()
  if (!cmake) {
    console.warn(
      'build-native: ptx-json not found and cmake is unavailable; timeline fallback binary will be missing until built manually.',
    )
    return
  }

  mkdirSync(buildDir, { recursive: true })
  try {
    execSync(`"${cmake}" -S "${nativeDir}" -B "${buildDir}"`, { stdio: 'inherit', shell: true })
    execSync(`"${cmake}" --build "${buildDir}" --config Release`, { stdio: 'inherit', shell: true })
  } catch (err) {
    console.warn('build-native: failed to compile ptx-json; timeline fallback binary will be missing.', err)
    return
  }

  const builtPath = findBuiltPtxJson(buildDir, binaryName)
  if (!builtPath) {
    console.warn('build-native: ptx-json build completed but binary was not found.')
    return
  }

  mkdirSync(resourcesBin, { recursive: true })
  execSync(
    process.platform === 'win32'
      ? `copy /Y "${builtPath}" "${installedPath}"`
      : `cp "${builtPath}" "${installedPath}"`,
    { stdio: 'inherit', shell: true },
  )
  console.log(`build-native: installed ${installedPath}`)
}

function verifyPtxJsonBundled(): void {
  const binaryName = platform === 'win32' ? 'ptx-json.exe' : 'ptx-json'
  const installedPath = join(resourcesBin, binaryName)
  if (!existsSync(installedPath)) {
    throw new Error(
      `ptx-json binary missing at ${installedPath}. Timeline export will fail in packaged builds.`,
    )
  }
}

verifyBinaryDirectory()
verifyWin32Runtime()
verifyWin32Hashes()
buildPtxJson()
verifyPtxJsonBundled()
