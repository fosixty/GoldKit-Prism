import { existsSync, mkdirSync } from 'fs'
import { execSync, spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resourcesBin = join(root, 'resources', 'bin')
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'

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
    if (process.platform !== 'win32') {
      execSync(`chmod 755 "${installedPath}"`, { stdio: 'inherit', shell: true })
    }
    console.log(`build-native: copied ${existingBuilt} -> ${installedPath}`)
    return
  }

  const cmake = findCmake()
  if (!cmake) {
    throw new Error(
      'ptx-json not found and cmake is unavailable. Install CMake or provide a prebuilt ptx-json binary.',
    )
  }

  mkdirSync(buildDir, { recursive: true })
  execSync(`"${cmake}" -S "${nativeDir}" -B "${buildDir}"`, { stdio: 'inherit', shell: true })
  execSync(`"${cmake}" --build "${buildDir}" --config Release`, { stdio: 'inherit', shell: true })

  const builtPath = findBuiltPtxJson(buildDir, binaryName)
  if (!builtPath) {
    throw new Error('ptx-json build completed but binary was not found.')
  }

  mkdirSync(resourcesBin, { recursive: true })
  execSync(
    process.platform === 'win32'
      ? `copy /Y "${builtPath}" "${installedPath}"`
      : `cp "${builtPath}" "${installedPath}"`,
    { stdio: 'inherit', shell: true },
  )
  if (process.platform !== 'win32') {
    execSync(`chmod 755 "${installedPath}"`, { stdio: 'inherit', shell: true })
  }
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

execSync('npm run build:ptformat', { stdio: 'inherit', shell: true, cwd: root })
buildPtxJson()
verifyPtxJsonBundled()
