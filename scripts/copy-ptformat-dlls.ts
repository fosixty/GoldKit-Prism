import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const targetDir = join(root, 'resources', 'ptformat', 'win32')

// Required at runtime by resources/ptformat/win32/ptformat.exe, confirmed via
// `ldd` against the MSYS2 UCRT64 build environment. Without these next to the
// exe, Windows fails to load it with STATUS_DLL_NOT_FOUND (-1073741515).
const REQUIRED_DLLS = [
  'libgcc_s_seh-1.dll',
  'libglib-2.0-0.dll',
  'libstdc++-6.dll',
  'libwinpthread-1.dll',
  'libintl-8.dll',
  'libiconv-2.dll',
  'libpcre2-8-0.dll',
]

function findMsys2UcrtBinDir(): string {
  const candidates = [
    process.env.MSYS2_ROOT ? join(process.env.MSYS2_ROOT, 'ucrt64', 'bin') : null,
    'C:\\msys64\\ucrt64\\bin',
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    `Could not locate the MSYS2 UCRT64 bin directory. Checked: ${candidates.join(', ')}. ` +
      'Install MSYS2 with the ucrt64 environment, or set MSYS2_ROOT to your MSYS2 install directory.',
  )
}

function copyPtformatDlls(): void {
  if (process.platform !== 'win32') {
    console.log('copy-ptformat-dlls: skipped (only relevant on win32).')
    return
  }

  const sourceDir = findMsys2UcrtBinDir()
  mkdirSync(targetDir, { recursive: true })

  const copied: string[] = []
  const missing: string[] = []

  for (const dll of REQUIRED_DLLS) {
    const sourcePath = join(sourceDir, dll)
    if (!existsSync(sourcePath)) {
      missing.push(dll)
      continue
    }
    copyFileSync(sourcePath, join(targetDir, dll))
    copied.push(dll)
  }

  if (missing.length > 0) {
    throw new Error(
      `Could not find the following required DLLs in ${sourceDir}: ${missing.join(', ')}`,
    )
  }

  console.log(`copy-ptformat-dlls: copied ${copied.length} DLL(s) from ${sourceDir} to ${targetDir}:`)
  for (const dll of copied) {
    console.log(`  - ${dll}`)
  }
}

copyPtformatDlls()
