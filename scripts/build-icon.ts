import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const buildDir = path.join(__dirname, '..', 'build')
  fs.mkdirSync(buildDir, { recursive: true })

  const logoPath = path.join(buildDir, 'prismlogo.png')
  const icoPath = path.join(buildDir, 'icon.ico')

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo not found at ${logoPath}. Copy prismlogo.png to build/ first.`)
  }

  const ico = await pngToIco(logoPath)
  fs.writeFileSync(icoPath, ico)
  console.log('Created build/icon.ico from prismlogo.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
