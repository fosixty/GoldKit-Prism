import { createHash } from 'crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { execSync, spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resourceRoot = join(root, 'resources', 'ptformat')
const ptformatSourceDir = join(root, 'native', 'ptx-json', 'ptformat')

const REQUIRED_WIN32_DLLS = [
  'libgcc_s_seh-1.dll',
  'libglib-2.0-0.dll',
  'libstdc++-6.dll',
  'libwinpthread-1.dll',
  'libintl-8.dll',
  'libiconv-2.dll',
  'libpcre2-8-0.dll',
]

const STATUS_DLL_NOT_FOUND = -1073741515
const STATUS_INVALID_IMAGE_FORMAT = -1073741701

function ensurePtformatSource(): void {
  const makefile = join(ptformatSourceDir, 'Makefile')
  const source = join(ptformatSourceDir, 'ptformat.cc')
  if (!existsSync(makefile) || !existsSync(source)) {
    throw new Error(
      `ptformat source not found in ${ptformatSourceDir}. Ensure native/ptx-json/ptformat is present.`,
    )
  }
}

function verifyWin32Runtime(win32Dir: string): void {
  const missingDlls = REQUIRED_WIN32_DLLS.filter((dll) => !existsSync(join(win32Dir, dll)))
  if (missingDlls.length > 0) {
    throw new Error(
      `ptformat.exe is missing required runtime DLLs in ${win32Dir}: ${missingDlls.join(', ')}. ` +
        'Run `npm run copy:ptformat-dlls` to regenerate them from your MSYS2 UCRT64 install.',
    )
  }

  const exePath = join(win32Dir, 'ptformat.exe')
  const result = spawnSync(exePath, [], {
    cwd: win32Dir,
    windowsHide: true,
    timeout: 5000,
  })

  if (result.error) {
    throw new Error(`Failed to launch ptformat.exe for a runtime smoke test: ${result.error.message}`)
  }

  if (result.status === STATUS_DLL_NOT_FOUND) {
    throw new Error(
      `ptformat.exe failed to start (STATUS_DLL_NOT_FOUND). Missing runtime DLLs in ${win32Dir}.`,
    )
  }

  if (result.status === STATUS_INVALID_IMAGE_FORMAT) {
    throw new Error(
      `ptformat.exe failed to start (STATUS_INVALID_IMAGE_FORMAT). Bundled DLLs may be the wrong architecture.`,
    )
  }
}

function verifyWin32Hashes(win32Dir: string): void {
  const manifestPath = join(__dirname, 'ptformat-hashes.json')
  const requireHashes = process.env.VERIFY_PTFORMAT_HASHES === '1'

  if (!existsSync(manifestPath)) {
    if (requireHashes) {
      throw new Error('ptformat hash manifest is missing at scripts/ptformat-hashes.json')
    }
    console.warn('build-ptformat: skipping ptformat hash verification (manifest not found).')
    return
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>
  const mismatches: string[] = []

  for (const [fileName, expectedHash] of Object.entries(manifest)) {
    const filePath = join(win32Dir, fileName)
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

function verifyWin32Binary(): void {
  const win32Dir = join(resourceRoot, 'win32')
  mkdirSync(win32Dir, { recursive: true })

  const existing = readdirSync(win32Dir)
  if (existing.length === 0 || existing.every((name) => name === '.gitkeep')) {
    throw new Error(
      `No ptformat binary found in ${win32Dir}. Place ptformat.exe before packaging.`,
    )
  }

  const exePath = join(win32Dir, 'ptformat.exe')
  if (!existsSync(exePath)) {
    throw new Error(`ptformat.exe missing in ${win32Dir}`)
  }

  verifyWin32Runtime(win32Dir)
  verifyWin32Hashes(win32Dir)
  console.log(`build-ptformat: verified ${exePath}`)
}

function installDarwinBinary(archDir: string, builtToolPath: string): void {
  const targetDir = join(resourceRoot, archDir)
  const targetPath = join(targetDir, 'ptformat')
  mkdirSync(targetDir, { recursive: true })
  copyFileSync(builtToolPath, targetPath)
  chmodSync(targetPath, 0o755)
  console.log(`build-ptformat: installed ${targetPath}`)
}

function compileDarwinPtformat(archDir: string, makePrefix: string[]): void {
  ensurePtformatSource()

  try {
    execSync([...makePrefix, 'make', '-C', ptformatSourceDir, 'clean'].join(' '), {
      stdio: 'inherit',
      shell: true,
    })
  } catch {
    // clean may fail on first build when ptftool does not exist yet
  }

  execSync([...makePrefix, 'make', '-C', ptformatSourceDir, 'all'].join(' '), {
    stdio: 'inherit',
    shell: true,
  })

  const builtToolPath = join(ptformatSourceDir, 'ptftool')
  if (!existsSync(builtToolPath)) {
    throw new Error(`ptformat compile succeeded but ptftool was not produced in ${ptformatSourceDir}`)
  }

  installDarwinBinary(archDir, builtToolPath)
}

function buildDarwinPtformat(): void {
  ensurePtformatSource()

  // Intel x64 is required for the studio iMac beta.
  compileDarwinPtformat('darwin-x64', ['arch', '-x86_64'])

  // Optional arm64 binary for Apple Silicon hosts when built natively.
  if (process.env.BUILD_PTFORMAT_ARM64 === '1') {
    compileDarwinPtformat('darwin-arm64', [])
  }
}

function verifyLinuxBinary(): void {
  const linuxDir = join(resourceRoot, 'linux-x64')
  mkdirSync(linuxDir, { recursive: true })
  const binaryPath = join(linuxDir, 'ptformat')
  if (!existsSync(binaryPath)) {
    throw new Error(`ptformat binary missing in ${linuxDir}. Place a prebuilt binary before packaging.`)
  }
  console.log(`build-ptformat: verified ${binaryPath}`)
}

function main(): void {
  if (process.platform === 'win32') {
    verifyWin32Binary()
    return
  }

  if (process.platform === 'darwin') {
    buildDarwinPtformat()
    return
  }

  verifyLinuxBinary()
}

main()
