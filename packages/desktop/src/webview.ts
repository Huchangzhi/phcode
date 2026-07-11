import { execSync, spawn } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

function openNativeWindow(
  url: string,
  title: string,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
) {
  const tmpFile = join(tmpdir(), `phcode_webview_${Date.now()}.ps1`)
  const safeUrl = url.replace(/'/g, "''")
  const safeTitle = title.replace(/'/g, "''")
  const script = `
Add-Type -AssemblyName System.Windows.Forms, PresentationFramework, WindowsFormsIntegration

$url = '${safeUrl}'
$title = '${safeTitle}'
$width = ${width}
$height = ${height}
$minWidth = ${minWidth}
$minHeight = ${minHeight}

function Open-WebView2 {
  try {
    $assembly = $null
    $searchPaths = @(
      [System.IO.Path]::Combine("${__dirname.replace(/\\/g, '\\\\')}", "Microsoft.Web.WebView2.WinForms.dll"),
      [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName), "Microsoft.Web.WebView2.WinForms.dll")
    )
    $nugetCache = [System.IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".nuget", "packages", "microsoft.web.webview2")
    if (Test-Path $nugetCache) {
      $latest = Get-ChildItem -Path $nugetCache -Recurse -Filter "Microsoft.Web.WebView2.WinForms.dll" -ErrorAction Stop |
        Sort-Object FullName -Descending | Select-Object -First 1
      if ($latest) { $searchPaths += $latest.FullName }
    }
    foreach ($p in $searchPaths) {
      if ([System.IO.File]::Exists($p)) {
        $assembly = [System.Reflection.Assembly]::LoadFrom($p)
        break
      }
    }
    if (-not $assembly) { return $false }

    $window = New-Object System.Windows.Window
    $window.Title = $title
    $window.Width = $width
    $window.Height = $height
    $window.MinWidth = $minWidth
    $window.MinHeight = $minHeight
    $window.WindowStartupLocation = 'CenterScreen'

    $hostCtrl = New-Object System.Windows.Forms.Integration.WindowsFormsHost
    $webview = New-Object Microsoft.Web.WebView2.WinForms.WebView2
    $hostCtrl.Child = $webview
    $window.Content = $hostCtrl

    $window.Add_Loaded({
      try {
        $webview.EnsureCoreWebView2Async().Wait()
        if ($webview.CoreWebView2) {
          $webview.CoreWebView2.Navigate($url)
        }
      } catch { Write-Warning "WebView2 navigate failed: $_" }
    })

    $window.Add_Closed({ try { $webview.Dispose() } catch {} })
    $window.ShowDialog() | Out-Null
    return $true
  } catch {
    Write-Warning "WebView2 failed: $_"
    return $false
  }
}

function Open-EdgeApp {
  try {
    $edge = "$env:PROGRAMFILES (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    if (-not (Test-Path $edge)) { $edge = "$env:PROGRAMFILES\\Microsoft\\Edge\\Application\\msedge.exe" }
    if (-not (Test-Path $edge)) { $edge = "msedge.exe" }
    Start-Process -FilePath $edge -ArgumentList "--app=$url" -NoNewWindow
    return $true
  } catch { return $false }
}

# Tier 1 – WebView2 with Edge Chromium engine
if (Open-WebView2) { return }

# Tier 2 – Edge app mode
Write-Warning "WebView2 assemblies not found, falling back to Edge app mode"
if (Open-EdgeApp) { return }

# Tier 3 – WPF WebBrowser (IE/Trident)
Write-Warning "Edge app mode failed, falling back to IE WebBrowser"
$fallback = New-Object System.Windows.Window
$fallback.Title = $title
$fallback.Width = $width
$fallback.Height = $height
$fallback.MinWidth = $minWidth
$fallback.MinHeight = $minHeight
$fallback.WindowStartupLocation = 'CenterScreen'
$fallback.ResizeMode = 'CanResize'
$browser = New-Object System.Windows.Controls.WebBrowser
$browser.Navigate($url)
$fallback.Content = $browser
$fallback.Add_Closed({ try { $browser.Dispose() } catch {} })
$fallback.ShowDialog() | Out-Null
`
  writeFileSync(tmpFile, script, 'utf-8')
  const proc = spawn(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile],
    { windowsHide: false, stdio: 'ignore' },
  )
  proc.on('exit', () => {
    try { unlinkSync(tmpFile) } catch { }
  })
  proc.on('error', () => {
    try { unlinkSync(tmpFile) } catch { }
  })
}

export function openWindow(
  url: string,
  title: string = 'PH Code Editor',
  width: number = 1200,
  height: number = 800,
  minWidth: number = 800,
  minHeight: number = 600,
) {
  if (process.platform === 'win32') {
    try {
      openNativeWindow(url, title, width, height, minWidth, minHeight)
      return
    } catch (err) {
      console.warn('Native window failed, falling back to browser:', err)
    }
  }
  openInBrowser(url)
}
