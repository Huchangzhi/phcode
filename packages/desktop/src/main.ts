import { existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createDesktopApp } from './server.js'
import { DebugManager } from './debug/manager.js'
import { StorageManager } from './storage/manager.js'
import { CompanionServer } from './companion/server.js'
import { openWindow } from './webview.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 27120

function findTool(name: string, bundledName: string): string {
  const candidates = [
    join(dirname(process.execPath), 'w64devkit', 'bin', bundledName),
    join(__dirname, '..', '..', '..', 'w64devkit', 'bin', bundledName),
    join(dirname(__dirname), 'w64devkit', 'bin', bundledName),
    join(__dirname, '..', '..', 'w64devkit', 'bin', bundledName),
    bundledName,
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`使用 ${name}: ${candidate}`)
      return candidate
    }
  }
  console.log(`使用默认 ${name}: ${bundledName}`)
  return bundledName
}

const debugManager = new DebugManager()
const storageManager = new StorageManager(resolve(__dirname, '..', '..', '..'))
const companionServer = new CompanionServer()

const toolSuffix = process.platform === 'win32' ? '.exe' : ''
const compilerPath = findTool('编译器', `g++${toolSuffix}`)
const gdbPath = findTool('GDB', `gdb${toolSuffix}`)

const app = createDesktopApp(debugManager, storageManager, compilerPath, gdbPath, true)

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PH Code Desktop v3 running on http://127.0.0.1:${PORT}`)
  console.log(`App Secret: ${storageManager.appSecret}`)

  companionServer.start(27121)
  debugManager.generatePairingCode()

  const url = `http://127.0.0.1:${PORT}/?app_secret=${storageManager.appSecret}`
  openWindow(url, 'PH Code Editor', 1200, 800, 800, 600)
})
