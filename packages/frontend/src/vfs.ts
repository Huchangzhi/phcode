interface VFSColors {
    bg: string; text: string; textWhite: string; textWarning: string
    btnPrimary: string; btnSecondary: string; btnDanger: string
}
interface VFSItem { type: 'file' | 'folder'; name: string; content?: string; children?: Record<string, VFSItem> }
interface VFSStructure { [path: string]: VFSItem }

declare global {
    interface Window {
        showDirectoryPicker(): Promise<FileSystemDirectoryHandle>
    }
    interface FileSystemDirectoryHandle {
        values(): AsyncIterableIterator<FileSystemHandle>
    }
}

const w = window as any

function findFileInList(list: string[], fileName: string): string | undefined {
    const lower = fileName.toLowerCase()
    return list.find(f => f.toLowerCase() === lower)
}
function hasFile(list: string[], fileName: string): boolean { return !!findFileInList(list, fileName) }
function findVFSFile(fileName: string): string | undefined {
    const lower = fileName.toLowerCase()
    return Object.keys(vfsStructure['/'].children!).find(k => k.toLowerCase() === lower)
}

function getVFSColors(): VFSColors {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    return isLight ? {
        bg: '#ffffff', text: '#333333', textWhite: '#333333', textWarning: '#9d6b00',
        btnPrimary: '#0078d4', btnSecondary: '#e0e0e0', btnDanger: '#ff4444',
    } : {
        bg: '#252526', text: '#cccccc', textWhite: '#ffffff', textWarning: '#ffcc00',
        btnPrimary: '#0e639c', btnSecondary: '#3c3c3c', btnDanger: '#ff4444',
    }
}

let vfsStructure: VFSStructure = { '/': { type: 'folder', name: 'root', children: {} } }
const VFS_STORAGE_KEY = 'phoi_vfs_structure'
let currentFileName = localStorage.getItem('phoi_currentFileName') || 'new.cpp'
let useNativeFS = localStorage.getItem('phoi_useNativeFS') === 'true'

class FileSystemManager {
    rootDir: FileSystemDirectoryHandle | null = null
    fileHandles: Map<string, FileSystemFileHandle> = new Map()

    async requestDirectoryAccess(): Promise<void> {
        const savedHandles = await this.restoreHandles()
        if (savedHandles && savedHandles.length > 0) {
            try {
                this.rootDir = await window.showDirectoryPicker()
                console.log('已获取文件夹访问权限')
            } catch (error: any) {
                console.error('用户拒绝了文件夹访问权限或无法获取权限:', error)
                if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                    fallbackToVirtualFS(error.message)
                }
                throw error
            }
        } else {
            try {
                this.rootDir = await window.showDirectoryPicker()
                await this.persistHandle(this.rootDir!)
                console.log('已获取文件夹访问权限')
            } catch (error: any) {
                console.error('用户拒绝了文件夹访问权限:', error)
                if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                    fallbackToVirtualFS(error.message)
                }
                throw error
            }
        }
        await this.loadFiles()
    }

    async restoreHandles(): Promise<any[] | null> {
        if (!('showDirectoryPicker' in window)) {
            console.log('File System Access API not supported')
            return null
        }
        try {
            const handles = JSON.parse(localStorage.getItem('phoi_dirHandles') || '[]')
            return handles.length > 0 ? handles : null
        } catch { return null }
    }

    async persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
        if (!('showDirectoryPicker' in window)) {
            console.log('File System Access API not supported')
            return
        }
        try {
            if ('requestPermission' in handle) {
                const permission = await (handle as any).requestPermission({ mode: 'readwrite' })
                if (permission !== 'granted') {
                    console.warn('未能获得持久化权限')
                    return
                }
            }
            localStorage.setItem('phoi_dirHandles', JSON.stringify([{ id: handle.name, kind: handle.kind }]))
        } catch { }
    }

    async loadFiles(): Promise<void> {
        if (!this.rootDir) return
        this.fileHandles.clear()
        for await (const entry of this.rootDir.values()) {
            if (entry.kind === 'file') {
                this.fileHandles.set(entry.name, entry as FileSystemFileHandle)
            }
        }
    }

    async getFileContent(fileName: string): Promise<string | null> {
        const fh = this.fileHandles.get(fileName)
        if (!fh) return null
        const file = await fh.getFile()
        return await file.text()
    }

    async saveFile(fileName: string, content: string): Promise<boolean> {
        if (!this.rootDir) return false
        let fh = this.fileHandles.get(fileName)
        if (!fh) {
            fh = await this.rootDir.getFileHandle(fileName, { create: true })
            this.fileHandles.set(fileName, fh)
        }
        const writable = await fh.createWritable()
        await writable.write(content)
        await writable.close()
        return true
    }

    async deleteFile(fileName: string): Promise<boolean> {
        if (!this.rootDir) return false
        if (!this.fileHandles.has(fileName)) return false
        await this.rootDir.removeEntry(fileName)
        this.fileHandles.delete(fileName)
        return true
    }

    getFileList(): string[] { return Array.from(this.fileHandles.keys()) }

    async createFile(fileName: string, content = ''): Promise<boolean> {
        if (!this.rootDir) return false
        const fh = await this.rootDir.getFileHandle(fileName, { create: true })
        this.fileHandles.set(fileName, fh)
        const writable = await fh.createWritable()
        await writable.write(content)
        await writable.close()
        return true
    }
}

class StorageBackend {
    available = false
    token: string | null = null
    root: string | null = null
    private appSecret: string | null = null

    constructor() {
        const params = new URLSearchParams(window.location.search)
        const urlSecret = params.get('app_secret')
        this.appSecret = urlSecret || sessionStorage.getItem('phoi_app_secret')
        if (urlSecret) {
            sessionStorage.setItem('phoi_app_secret', urlSecret)
            params.delete('app_secret')
            const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash
            history.replaceState(null, '', cleanUrl)
        }
    }

    private get baseUrl(): string { return '' }

    async checkAvailability(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/status`)
            if (!res.ok) return false
            const data = await res.json()
            this.available = data.available === true
            this.root = data.hasRoot ? (data.root || null) : null
            if (!this.root) {
                const savedRoot = localStorage.getItem('phoi_storage_root')
                if (savedRoot) this.root = savedRoot
            }
            return this.available
        } catch { return false }
    }

    async initSession(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/init`, {
                method: 'POST',
                headers: { 'X-PHOI-App-Secret': this.appSecret || '' }
            })
            if (!res.ok) return false
            const data = await res.json()
            this.token = data.token
            sessionStorage.setItem('phoi_storage_token', this.token!)
            return true
        } catch { return false }
    }

    private _headers(): Record<string, string> {
        return { 'Content-Type': 'application/json', 'X-PHOI-Storage-Token': this.token! }
    }

    async selectDir(): Promise<string | null> {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/select-dir`, {
                method: 'POST', headers: this._headers()
            })
            if (res.ok) {
                const data = await res.json()
                this.root = data.path
                return data.path
            }
        } catch {}
        return null
    }

    async listFiles(): Promise<string[]> {
        const res = await fetch(`${this.baseUrl}/api/storage/list`, {
            method: 'POST', headers: this._headers()
        })
        if (!res.ok) return []
        const data = await res.json()
        return data.files || []
    }

    async readFile(fileName: string): Promise<string | null> {
        const res = await fetch(`${this.baseUrl}/api/storage/read`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ fileName })
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.content
    }

    async writeFile(fileName: string, content: string): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/api/storage/write`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ fileName, content })
        })
        return res.ok
    }

    async deleteFile(fileName: string): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/api/storage/delete`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ fileName })
        })
        return res.ok
    }

    async renameFile(oldName: string, newName: string): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/api/storage/rename`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ oldName, newName })
        })
        return res.ok
    }

    async verifyToken(): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/ping`, {
                method: 'POST', headers: this._headers()
            })
            return res.ok
        } catch { return false }
    }

    async rememberRoot(path: string): Promise<void> {
        try {
            await fetch(`${this.baseUrl}/api/storage/remember-root`, {
                method: 'POST', headers: this._headers(),
                body: JSON.stringify({ path })
            })
        } catch { }
    }
}

const storageBackend = new StorageBackend()
const fsManager = new FileSystemManager()

async function ensureBackendReady(): Promise<boolean> {
    if (!useNativeFS || !storageBackend.available || !storageBackend.token) return false
    if (storageBackend.root) return true
    const savedRoot = localStorage.getItem('phoi_storage_root')
    if (savedRoot) {
        storageBackend.root = savedRoot
        await storageBackend.rememberRoot(savedRoot).catch(() => { })
        return true
    }
    const path = await storageBackend.selectDir()
    if (!path) {
        useNativeFS = false
        localStorage.setItem('phoi_useNativeFS', 'false')
        if (typeof w.showMessage === 'function') w.showMessage('未选择文件夹，已回退到浏览器存储', 'system')
        return false
    }
    localStorage.setItem('phoi_storage_root', path)
    await storageBackend.rememberRoot(path)
    await renderVFS()
    return true
}

async function initVFSModule(): Promise<void> {
    if (useNativeFS) {
        let backendOk = false
        for (let i = 0; i < 5; i++) {
            backendOk = await storageBackend.checkAvailability()
            if (backendOk) break
            await new Promise(r => setTimeout(r, 500))
        }
        if (backendOk) {
            const savedToken = sessionStorage.getItem('phoi_storage_token')
            if (savedToken) {
                storageBackend.token = savedToken
            } else {
                await storageBackend.initSession()
            }
            if (storageBackend.token && storageBackend.available) {
                const valid = await storageBackend.verifyToken()
                if (!valid) {
                    storageBackend.token = null
                    sessionStorage.removeItem('phoi_storage_token')
                    await storageBackend.initSession()
                }
            }
        }
    }
    if (useNativeFS && 'showDirectoryPicker' in window && !fsManager.rootDir && !storageBackend.available) {
        showPermissionRequestModal(false)
    } else if (useNativeFS && storageBackend.available && storageBackend.token && !storageBackend.root) {
        const savedRoot = localStorage.getItem('phoi_storage_root')
        if (savedRoot) {
            storageBackend.root = savedRoot
            initializeVFS()
            await renderVFS()
            setupEventListeners()
            updateCurrentFileNameDisplay()
        } else {
            showPermissionRequestModal(true)
        }
    } else {
        initializeVFS()
        await renderVFS()
        setupEventListeners()
        updateCurrentFileNameDisplay()
    }
}

function showPermissionRequestModal(backendMode: boolean): void {
    const colors = getVFSColors()
    const overlay = document.createElement('div')
    overlay.id = 'permission-request-overlay'
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;'
    const modal = document.createElement('div')
    modal.id = 'permission-request-modal'
    modal.style.cssText = `background:${colors.bg};padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);text-align:center;max-width:400px;width:80%;color:${colors.text};`
    const btnContainer = document.createElement('div')
    btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px;'
    const finishSetup = async () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay)
        initializeVFS()
        await renderVFS()
        setupEventListeners()
        updateCurrentFileNameDisplay()
    }
    if (backendMode) {
        const title = document.createElement('h3'); title.textContent = '本地储存'; title.style.cssText = `color:${colors.textWhite};margin-top:0;`
        modal.appendChild(title)
        const msg = document.createElement('p'); msg.textContent = '已连接到本地储存后端，请选择储存方式：'; msg.style.cssText = 'margin-bottom:20px;line-height:1.5;'
        modal.appendChild(msg)
        const selectBtn = document.createElement('button')
        selectBtn.textContent = '选择本地文件夹'
        selectBtn.style.cssText = `background:${colors.btnPrimary};color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px;`
        selectBtn.onclick = async () => {
            if (document.body.contains(overlay)) document.body.removeChild(overlay)
            const ready = await ensureBackendReady()
            finishSetup()
        }
        const virtualBtn = document.createElement('button')
        virtualBtn.textContent = '返回在线储存'
        virtualBtn.style.cssText = `background:${colors.btnSecondary};color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px;`
        virtualBtn.onclick = async () => {
            useNativeFS = false; localStorage.setItem('phoi_useNativeFS', 'false')
            finishSetup()
        }
        btnContainer.appendChild(selectBtn); btnContainer.appendChild(virtualBtn)
    } else {
        const title = document.createElement('h3'); title.textContent = '本地文件系统权限'; title.style.cssText = `color:${colors.textWhite};margin-top:0;`
        modal.appendChild(title)
        const msg = document.createElement('p'); msg.textContent = '您已启用本地文件系统功能，但尚未授权访问权限。请选择：'; msg.style.cssText = 'margin-bottom:20px;line-height:1.5;'
        modal.appendChild(msg)
        const grantBtn = document.createElement('button')
        grantBtn.textContent = '授权本地文件访问'
        grantBtn.style.cssText = `background:${colors.btnPrimary};color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px;`
        grantBtn.onclick = () => {
            setTimeout(() => {
                if (document.body.contains(overlay)) document.body.removeChild(overlay)
                requestNativeFSPermission().then(() => {
                    initializeVFS()
                    renderVFS()
                    setupEventListeners()
                    updateCurrentFileNameDisplay()
                }).catch(error => {
                    console.error('获取本地文件系统权限失败:', error)
                    const dlg = w.PhoiDialog
                    if (dlg) dlg.alert('获取文件访问权限失败: ' + error.message)
                    else alert('获取文件访问权限失败: ' + error.message)
                    initializeVFS()
                    renderVFS()
                    setupEventListeners()
                    updateCurrentFileNameDisplay()
                })
            }, 0)
        }
        const virtualBtn = document.createElement('button')
        virtualBtn.textContent = '返回虚拟文件系统'
        virtualBtn.style.cssText = `background:${colors.btnSecondary};color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px;`
        virtualBtn.onclick = async () => {
            useNativeFS = false; localStorage.setItem('phoi_useNativeFS', 'false')
            finishSetup()
        }
        btnContainer.appendChild(grantBtn); btnContainer.appendChild(virtualBtn)
    }
    modal.appendChild(btnContainer)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)
}

function initializeVFS(): void {
    const savedVFS = localStorage.getItem(VFS_STORAGE_KEY)
    if (savedVFS) {
        vfsStructure = JSON.parse(savedVFS)
    } else {
        vfsStructure = { '/': { type: 'folder', name: 'root', children: {} } }
        const savedCode = localStorage.getItem('phoi_savedCode')
        const currentFile = localStorage.getItem('phoi_currentFileName') || 'new.cpp'
        if (!vfsStructure['/'].children![currentFile]) {
            const codeToSave = savedCode || (localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`)
            vfsStructure['/'].children![currentFile] = { type: 'file', name: currentFile, content: codeToSave }
            localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure))
        } else {
            localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure))
        }
    }
}

function saveVFS(): void {
    localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure))
}

async function renderVFS(): Promise<void> {
    if (!w.vfsContent) return
    w.vfsContent.innerHTML = ''
    const btnContainer = document.createElement('div')
    btnContainer.style.padding = '10px'
    btnContainer.style.borderBottom = '1px solid #444'
    const newFileBtn = document.createElement('button')
    newFileBtn.textContent = '+ 文件'
    newFileBtn.onclick = newFile
    btnContainer.appendChild(newFileBtn)
    w.vfsContent.appendChild(btnContainer)
    const rootDiv = document.createElement('div')
    rootDiv.className = 'vfs-folder'
    rootDiv.textContent = '根目录'
    rootDiv.dataset.path = '/'
    rootDiv.addEventListener('click', () => console.log('展开根目录'))
    w.vfsContent.appendChild(rootDiv)
    await renderVFSDirectory('/', w.vfsContent)
}

async function openFile(filePath: string): Promise<boolean | undefined> {
    const pathParts = filePath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    let fileExists = false
    if (useNativeFS && storageBackend.available && storageBackend.root) {
        try { fileExists = hasFile(await storageBackend.listFiles(), fileName) } catch { }
    } else if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (fsManager.rootDir) fileExists = hasFile(await fsManager.getFileList(), fileName)
        } catch { }
    } else {
        fileExists = !!findVFSFile(fileName)
    }
    if (!fileExists) fileExists = !!findVFSFile(fileName)
    if (fileExists) {
        if (w.PhoiAPI && typeof w.PhoiAPI.openFile === 'function') {
            const success = await w.PhoiAPI.openFile(fileName)
            if (success) {
                if (w.vfsPanel) w.vfsPanel.style.display = 'none'
                if (w.sidebarToggle) w.sidebarToggle.classList.remove('vfs-open')
            }
            return success
        }
    }
}

async function renderVFSDirectory(_path: string, parentElement: HTMLElement): Promise<void> {
    if (!parentElement) return
    const colors = getVFSColors()
    let files: any[] = []
    if (useNativeFS && storageBackend.available) {
        if (storageBackend.root) {
            try { files = await storageBackend.listFiles() } catch { }
        } else {
            const container = document.createElement('div')
            container.className = 'vfs-subfolder'
            container.style.paddingLeft = '16px'
            const selectItem = document.createElement('div')
            selectItem.className = 'vfs-file'
            selectItem.style.cssText = `color:${colors.textWarning};display:flex;justify-content:space-between;align-items:center;padding:5px;cursor:pointer;font-style:italic;`
            const selectText = document.createElement('span')
            selectText.textContent = '（点击选择本地文件夹）'
            selectText.style.flexGrow = '1'
            selectItem.appendChild(selectText)
            selectItem.addEventListener('click', async (e) => { e.stopPropagation(); if (await ensureBackendReady()) renderVFS() })
            container.appendChild(selectItem)
            parentElement.appendChild(container)
            return
        }
    } else if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) {
                const container = document.createElement('div')
                container.className = 'vfs-subfolder'
                container.style.paddingLeft = '16px'
                const permItem = document.createElement('div')
                permItem.className = 'vfs-file'
                permItem.style.cssText = `color:${colors.textWarning};display:flex;justify-content:space-between;align-items:center;padding:5px;cursor:default;font-style:italic;`
                const permText = document.createElement('span')
                permText.textContent = '（暂无权限，请在设置中启用）'
                permText.style.flexGrow = '1'
                permItem.appendChild(permText)
                container.appendChild(permItem)
                parentElement.appendChild(container)
                return
            } else { files = await fsManager.getFileList() }
        } catch { }
    } else {
        const folder = vfsStructure[_path]
        if (folder && folder.children) {
            for (const itemName in folder.children) {
                const item = folder.children[itemName]
                if (item.type === 'file') files.push(item)
            }
        }
    }
    const container = document.createElement('div')
    container.className = 'vfs-subfolder'
    container.style.paddingLeft = '16px'
    for (const item of files) {
        const itemName = typeof item === 'string' ? item : item.name
        const itemElement = document.createElement('div')
        itemElement.className = 'vfs-file'
        itemElement.style.cssText = `color:${colors.textWhite};display:flex;justify-content:space-between;align-items:center;padding:5px;cursor:pointer;`
        const nameSpan = document.createElement('span')
        nameSpan.textContent = itemName
        nameSpan.style.flexGrow = '1'
        itemElement.appendChild(nameSpan)
        const delBtn = document.createElement('button')
        delBtn.textContent = '×'
        delBtn.style.cssText = `background:${colors.btnDanger};color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;`
        delBtn.onclick = (e) => { e.stopPropagation(); deleteFile(itemName) }
        itemElement.appendChild(delBtn)
        itemElement.dataset.path = _path + itemName
        itemElement.addEventListener('click', function (e) {
            if (e.target !== delBtn) openFile(this.dataset.path!)
        })
        container.appendChild(itemElement)
    }
    parentElement.appendChild(container)
}

async function deleteFile(fileName: string): Promise<void> {
    if (w.PhoiAPI && w.PhoiAPI.getCurrentFileName && fileName === w.PhoiAPI.getCurrentFileName()) {
        const dlg = w.PhoiDialog
        if (dlg) { await dlg.alert(`无法删除当前正在使用的文件 "${fileName}"`); return }
        else { alert(`无法删除当前正在使用的文件 "${fileName}"`); return }
    }
    let shouldDelete = false
    const dlg = w.PhoiDialog
    if (dlg) shouldDelete = await dlg.confirm(`确定要删除文件 "${fileName}" 吗？`)
    else shouldDelete = confirm(`确定要删除文件 "${fileName}" 吗？`)
    if (!shouldDelete) return
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        if (await storageBackend.deleteFile(fileName)) { await renderVFS(); if (typeof w.showMessage === 'function') w.showMessage(`文件 "${fileName}" 已删除`, 'user'); return }
    }
    if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
            await fsManager.deleteFile(fileName)
            await renderVFS()
            if (typeof w.showMessage === 'function') w.showMessage(`文件 "${fileName}" 已删除`, 'user')
        } catch { }
    } else {
        const vfsKey = findVFSFile(fileName)
        if (vfsKey) delete vfsStructure['/'].children![vfsKey]
        saveVFS()
        await renderVFS()
        if (typeof w.showMessage === 'function') w.showMessage(`文件 "${fileName}" 已删除`, 'user')
    }
}

async function toggleVFSPanel(): Promise<void> {
    if (!w.vfsPanel || !w.sidebarToggle) return
    if (w.vfsPanel.style.display === 'none' || w.vfsPanel.style.display === '') {
        w.vfsPanel.style.display = 'flex'
        w.sidebarToggle.classList.add('vfs-open')
        await renderVFS()
    } else {
        w.vfsPanel.style.display = 'none'
        w.sidebarToggle.classList.remove('vfs-open')
    }
}

async function uploadFile(): Promise<void> {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async (event: any) => {
        const file: File = event.target.files[0]
        const reader = new FileReader()
        reader.onload = async (e: any) => {
            const content = e.target.result as string
            const fileName = file.name
            if (await ensureBackendReady()) {
                if (await storageBackend.writeFile(fileName, content)) { await renderVFS(); openFile(fileName); return }
            }
            if (useNativeFS && 'showDirectoryPicker' in window) {
                try {
                    if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
                    await fsManager.createFile(fileName, content)
                    await renderVFS(); openFile(fileName); return
                } catch { }
            }
            const vfsKey = findVFSFile(fileName)
            if (vfsKey) { vfsStructure['/'].children![vfsKey].content = content }
            else { vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content } }
            saveVFS(); await renderVFS(); openFile(fileName)
        }
        reader.readAsText(file)
    }
    input.click()
}

function downloadCurrentFile(): void {
    if (w.PhoiAPI && w.PhoiAPI.getCurrentFileContent && w.PhoiAPI.getCurrentFileName) {
        const content = w.PhoiAPI.getCurrentFileContent()
        const fn = w.PhoiAPI.getCurrentFileName() || 'current.cpp'
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = fn
        document.body.appendChild(a); a.click()
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
    }
}

async function saveCurrentFileAs(): Promise<void> {
    if (!w.PhoiAPI || !w.PhoiAPI.getCurrentFileContent) return
    const currentContent = w.PhoiAPI.getCurrentFileContent()
    const dlg = w.PhoiDialog
    const fileName = dlg ? await dlg.prompt('请输入文件名:', 'new_file.cpp') : prompt('请输入文件名:', 'new_file.cpp')
    if (!fileName) return
    if (await ensureBackendReady()) {
        if (await storageBackend.writeFile(fileName, currentContent)) {
            if (w.PhoiAPI.setCurrentFileName) w.PhoiAPI.setCurrentFileName(fileName)
            await renderVFS(); w.showMessage(`文件已另存为: ${fileName}`, 'user'); return
        }
    }
    vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content: currentContent }
    saveVFS(); await renderVFS()
    if (w.PhoiAPI.setCurrentFileName) w.PhoiAPI.setCurrentFileName(fileName)
    if (typeof w.showMessage === 'function') w.showMessage(`文件已另存为: ${fileName}`, 'user')
}

async function newFile(): Promise<void> {
    const dlg = w.PhoiDialog
    const fileName = dlg ? await dlg.prompt('请输入文件名:', 'new.cpp') : prompt('请输入文件名:', 'new.cpp')
    if (!fileName) return
    if (await ensureBackendReady()) {
        const list = await storageBackend.listFiles()
        const existing = findFileInList(list, fileName)
        if (existing) { openFile(existing); return }
        const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`
        if (await storageBackend.writeFile(fileName, defaultCode)) { await renderVFS(); openFile(fileName); return }
    }
    if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
            const fileList = await fsManager.getFileList()
            if (hasFile(fileList, fileName)) {
                if (dlg) await dlg.alert('文件已存在！'); else alert('文件已存在！')
                return
            }
            const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`
            await fsManager.createFile(fileName, defaultCode)
            await renderVFS(); openFile(fileName)
        } catch { }
    } else {
        const existingKey = findVFSFile(fileName)
        if (existingKey) { if (dlg) dlg.alert('文件已存在！'); else alert('文件已存在！'); return }
        const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`
        vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content: defaultCode }
        saveVFS(); await renderVFS(); openFile(fileName)
    }
}

async function saveFileToVFS(fileName: string, content: string): Promise<void> {
    if (!fileName) return
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        if (await storageBackend.writeFile(fileName, content)) return
    }
    if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
            await fsManager.saveFile(fileName, content)
        } catch (error: any) {
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message)
                const vfsKey = findVFSFile(fileName)
                if (!vfsKey) vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content }
                else vfsStructure['/'].children![vfsKey].content = content
                saveVFS()
            }
        }
    } else {
        const vfsKey = findVFSFile(fileName)
        if (!vfsKey) vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content }
        else vfsStructure['/'].children![vfsKey].content = content
        saveVFS()
    }
}

async function getFileContent(fileName: string): Promise<string | null> {
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        const content = await storageBackend.readFile(fileName)
        if (content !== null) return content
    }
    if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
            const content = await fsManager.getFileContent(fileName)
            if (content !== null) return content
        } catch (error: any) {
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') { fallbackToVirtualFS(error.message); useNativeFS = false }
        }
        return null
    }
    const vfsKey = findVFSFile(fileName)
    if (vfsKey) return vfsStructure['/'].children![vfsKey].content ?? null
    const fileKey = `phoi_file_${fileName}`
    const fileContent = localStorage.getItem(fileKey)
    if (fileContent !== null) {
        vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content: fileContent }
        saveVFS()
        return fileContent
    }
    return null
}

async function createNewFile(fileName: string, content = ''): Promise<any> {
    const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`
    const fileContent = content || defaultCode
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        const list = await storageBackend.listFiles()
        const existing = findFileInList(list, fileName)
        if (existing) return PhoiAPI_openFile(existing)
        if (await storageBackend.writeFile(fileName, fileContent)) { await renderVFS(); return PhoiAPI_openFile(fileName) }
    }
    if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
            const fileList = await fsManager.getFileList()
            const existing = findFileInList(fileList, fileName)
            if (existing) return PhoiAPI_openFile(existing)
            await fsManager.createFile(fileName, fileContent)
            return PhoiAPI_openFile(fileName)
        } catch (error: any) {
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') { fallbackToVirtualFS(error.message); useNativeFS = false }
            else { console.log('由于错误，回退到虚拟文件系统'); useNativeFS = false; localStorage.setItem('phoi_useNativeFS', 'false') }
        }
    }
    const lowerName = fileName.toLowerCase()
    const existingVFS = Object.keys(vfsStructure['/'].children!).find(k => k.toLowerCase() === lowerName)
    if (existingVFS) return PhoiAPI_openFile(existingVFS)
    vfsStructure['/'].children![fileName] = { type: 'file', name: fileName, content: fileContent }
    saveVFS(); await renderVFS()
    return PhoiAPI_openFile(fileName)
}

function PhoiAPI_openFile(fileName: string): any {
    if (w.PhoiAPI && typeof w.PhoiAPI.openFile === 'function') return w.PhoiAPI.openFile(fileName)
    return openFile(fileName)
}

async function getFileList(): Promise<string[]> {
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        try { return await storageBackend.listFiles() } catch { console.warn('存储后端列表失败，降级') }
    }
    if (useNativeFS && 'showDirectoryPicker' in window) {
        try {
            if (!fsManager.rootDir) await fsManager.requestDirectoryAccess()
            return fsManager.getFileList()
        } catch (error) { console.error('获取本地文件列表失败:', error) }
    }
    if (!vfsStructure) return []
    return Object.keys(vfsStructure['/'].children!).filter(k => vfsStructure['/'].children![k].type === 'file')
}

function updateCurrentFileNameDisplay(): void {
    const el = document.getElementById('current-file-name')
    if (el) el.textContent = currentFileName
}

function setupEventListeners(): void {
    if (w.vfsCloseBtn) {
        w.vfsCloseBtn.addEventListener('click', () => {
            if (w.vfsPanel) w.vfsPanel.style.display = 'none'
            if (w.sidebarToggle) w.sidebarToggle.classList.remove('vfs-open')
        })
    }
    if (w.sidebarToggle) w.sidebarToggle.addEventListener('click', toggleVFSPanel)
}

async function requestNativeFSPermission(): Promise<void> {
    try {
        await fsManager.requestDirectoryAccess()
        await fsManager.createFile('!phcode.test', 'This is a test file for phcode permissions.')
        await fsManager.deleteFile('!phcode.test')
        const overlay = document.getElementById('permission-request-overlay')
        if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay)
    } catch (error: any) {
        fallbackToVirtualFS(error.message)
        throw error
    }
}

async function fallbackToVirtualFS(errorMessage = ''): Promise<void> {
    useNativeFS = false
    localStorage.setItem('phoi_useNativeFS', 'false')
    showFallbackNotification(errorMessage)
    initializeVFS()
    await renderVFS()
    setupEventListeners()
    updateCurrentFileNameDisplay()
}

function showFallbackNotification(errorMessage = ''): void {
    const colors = getVFSColors()
    const notification = document.createElement('div')
    notification.id = 'fallback-notification'
    notification.style.cssText = `position:fixed;top:20px;right:20px;background:${colors.btnDanger};color:white;padding:15px 20px;border-radius:5px;z-index:10001;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;word-wrap:break-word;`
    notification.innerHTML = `<div style="margin-bottom:10px;font-weight:bold;">本地文件系统授权问题</div><div>已自动回退到虚拟文件系统</div>${errorMessage ? `<div style="margin-top:8px;font-size:0.9em;opacity:0.8;">错误: ${errorMessage}</div>` : ''}`
    const closeBtn = document.createElement('span')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.cssText = 'position:absolute;top:5px;right:10px;cursor:pointer;font-size:20px;'
    closeBtn.onclick = () => { if (document.body.contains(notification)) document.body.removeChild(notification) }
    notification.appendChild(closeBtn)
    document.body.appendChild(notification)
    setTimeout(() => { if (document.body.contains(notification)) document.body.removeChild(notification) }, 5000)
}

const vfsModule = {
    initVFSModule, initializeVFS, saveVFS, renderVFS, openFile, deleteFile, toggleVFSPanel,
    uploadFile, downloadCurrentFile, saveCurrentFileAs, newFile, saveFileToVFS, getFileContent,
    createNewFile, getFileList,
    getStorageBackend: () => storageBackend,
    getCurrentFileName: () => currentFileName,
    setCurrentFileName: (fileName: string) => { currentFileName = fileName; localStorage.setItem('phoi_currentFileName', currentFileName); updateCurrentFileNameDisplay() }
}

w.vfsModule = vfsModule

export { vfsModule, initVFSModule, initializeVFS, saveVFS, renderVFS, openFile, deleteFile, toggleVFSPanel, uploadFile, downloadCurrentFile, saveCurrentFileAs, newFile, saveFileToVFS, getFileContent, createNewFile, getFileList, FileSystemManager, StorageBackend, currentFileName, useNativeFS, fsManager, storageBackend }
