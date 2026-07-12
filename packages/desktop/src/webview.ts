import { NativeWindow } from '@nativewindow/webview'
import { execSync } from 'child_process'
import { appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const LOG = join(tmpdir(), 'phcode_wv.log')
function log(msg: string) {
  try { appendFileSync(LOG, `${Date.now()} ${msg}\n`) } catch {}
}

function openInBrowser(url: string) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`
  try {
    execSync(cmd)
  } catch {
    console.log(`Please open manually: ${url}`)
  }
}

export function openWindow(
  url: string,
  title: string = 'PH Code Editor',
  width: number = 1200,
  height: number = 800,
  minWidth: number = 800,
  minHeight: number = 600,
) {
  try {
    const win = new NativeWindow({
      title,
      width,
      height,
      minWidth,
      minHeight,
      resizable: true,
    })
    log('window created')
    win.loadUrl(url)
    log(`navigated to ${url}`)
    win.onPageLoad((event, pageUrl) => log(`page ${event}: ${pageUrl}`))
    win.onClose(() => log('window closed'))
  } catch (err) {
    log(`error: ${err}`)
    console.warn('Native window failed, falling back to browser:', err)
    openInBrowser(url)
  }
}
