import { NativeWindow } from '@nativewindow/webview'
import { execSync } from 'child_process'

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
    win.loadUrl(url)
    win.onClose(() => process.exit(0))
  } catch (err) {
    console.warn('Native window failed, falling back to browser:', err)
    openInBrowser(url)
  }
}
