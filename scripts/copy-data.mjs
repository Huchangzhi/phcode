import { copyFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'packages', 'frontend', 'public', 'static', 'data')
const dest = join(root, 'packages', 'frontend', 'dist', 'static', 'data')

if (!existsSync(src)) {
  console.log('static/data not found, skipping copy')
  process.exit(0)
}

function copyDir(srcDir, destDir) {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
  const entries = readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

console.log(`Copying static/data to frontend dist...`)
copyDir(src, dest)
console.log('Done')
