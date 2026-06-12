// --- 虚拟文件系统 (VFS) 实现 ---

// 大小写不敏感的文件名查找
function findFileInList(list, fileName) {
    const lower = fileName.toLowerCase();
    return list.find(f => f.toLowerCase() === lower);
}
function hasFile(list, fileName) {
    return !!findFileInList(list, fileName);
}

// 主题颜色辅助函数
function getVFSColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight ? {
        bg: '#ffffff',
        text: '#333333',
        textWhite: '#333333',
        textWarning: '#9d6b00',
        btnPrimary: '#0078d4',
        btnSecondary: '#e0e0e0',
        btnDanger: '#ff4444',
    } : {
        bg: '#252526',
        text: '#cccccc',
        textWhite: '#ffffff',
        textWarning: '#ffcc00',
        btnPrimary: '#0e639c',
        btnSecondary: '#3c3c3c',
        btnDanger: '#ff4444',
    };
}

// 虚拟文件系统相关变量
let vfsStructure = null;
const VFS_STORAGE_KEY = 'phoi_vfs_structure';
let currentFileName = localStorage.getItem('phoi_currentFileName') || 'new.cpp'; // 当前正在编辑的文件名

// 文件系统管理模式（单个设置项）
let useNativeFS = localStorage.getItem('phoi_useNativeFS') === 'true';

// 文件系统管理器类
class FileSystemManager {
  constructor() {
    this.rootDir = null;
    this.fileHandles = new Map();
  }

  async requestDirectoryAccess() {
    // 检查是否已有保存的权限
    const savedHandles = await this.restoreHandles();

    if (savedHandles && savedHandles.length > 0) {
      // 尝试获取已保存的目录句柄
      try {
        // 使用showDirectoryPicker来获取之前保存的目录句柄
        // 注意：这仍需要用户手势，所以我们直接请求新权限
        this.rootDir = await window.showDirectoryPicker();
        console.log('已获取文件夹访问权限');
      } catch (error) {
        // 如果无法获取权限，可能是用户撤销了权限或目录不存在
        console.error('用户拒绝了文件夹访问权限或无法获取权限:', error);
        // 检查错误类型，如果是权限相关错误，则自动回退
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          fallbackToVirtualFS(error.message);
        }
        throw error; // 重新抛出错误，让调用者处理
      }
    } else {
      // 首次访问，请求用户授权
      try {
        this.rootDir = await window.showDirectoryPicker();
        await this.persistHandle(this.rootDir);
        console.log('已获取文件夹访问权限');
      } catch (error) {
        console.error('用户拒绝了文件夹访问权限:', error);
        // 检查错误类型，如果是权限相关错误，则自动回退
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          fallbackToVirtualFS(error.message);
        }
        throw error; // 重新抛出错误，让调用者处理
      }
    }

    // 加载文件列表
    await this.loadFiles();
  }

  async restoreHandles() {
    if (!('showDirectoryPicker' in window)) {
      console.log('File System Access API not supported');
      return null;
    }

    try {
      const handles = JSON.parse(localStorage.getItem('phoi_dirHandles') || '[]');
      if (handles.length > 0) {
        // 只返回存储的信息，不尝试获取句柄，因为这需要用户手势
        return handles; // 返回存储的句柄信息
      }
    } catch (error) {
      console.error('Error restoring handles:', error);
    }
    return null;
  }

  async persistHandle(handle) {
    if (!('showDirectoryPicker' in window)) {
      console.log('File System Access API not supported');
      return;
    }

    try {
      // 使用FileSystemHandle的特性来持久化权限
      if ('requestPermission' in handle) {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          console.warn('未能获得持久化权限');
          return;
        }
      }

      // 存储句柄信息
      const serializedHandle = {
        id: handle.name, // 使用目录名称作为ID
        kind: handle.kind
      };
      localStorage.setItem('phoi_dirHandles', JSON.stringify([serializedHandle]));
    } catch (error) {
      console.error('Error persisting handle:', error);
    }
  }

  async loadFiles() {
    if (!this.rootDir) return;
    
    this.fileHandles.clear();
    for await (const entry of this.rootDir.values()) {
      if (entry.kind === 'file') {
        this.fileHandles.set(entry.name, entry);
      }
    }
  }

  async getFileContent(fileName) {
    if (!this.rootDir) return null;
    
    const fileHandle = this.fileHandles.get(fileName);
    if (!fileHandle) return null;
    
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async saveFile(fileName, content) {
    if (!this.rootDir) return false;
    
    let fileHandle = this.fileHandles.get(fileName);
    
    if (!fileHandle) {
      // 如果文件不存在，创建新文件
      fileHandle = await this.rootDir.getFileHandle(fileName, { create: true });
      this.fileHandles.set(fileName, fileHandle);
    }
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return true;
  }

  async deleteFile(fileName) {
    if (!this.rootDir) return false;
    
    const fileHandle = this.fileHandles.get(fileName);
    if (!fileHandle) return false;
    
    await this.rootDir.removeEntry(fileName);
    this.fileHandles.delete(fileName);
    
    return true;
  }

  getFileList() {
    return Array.from(this.fileHandles.keys());
  }

  async createFile(fileName, content = '') {
    if (!this.rootDir) return false;
    
    const fileHandle = await this.rootDir.getFileHandle(fileName, { create: true });
    this.fileHandles.set(fileName, fileHandle);
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return true;
  }
}

// ── Python 本地存储后端 ──────────────────────────────────────
class StorageBackend {
    constructor() {
        this.available = false;
        this.token = null;
        this.root = null;
        this.appSecret = null;
        // 从 URL query param 或 sessionStorage 读取 app_secret
        const params = new URLSearchParams(window.location.search);
        const urlSecret = params.get('app_secret');
        this.appSecret = urlSecret || sessionStorage.getItem('phoi_app_secret');
        if (urlSecret) {
            sessionStorage.setItem('phoi_app_secret', urlSecret);
            params.delete('app_secret');
            const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
            history.replaceState(null, '', cleanUrl);
        }
    }

    get baseUrl() { return ''; } // 同源，空串

    async checkAvailability() {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/status`);
            if (!res.ok) return false;
            const data = await res.json();
            this.available = data.available === true;
            this.root = data.hasRoot ? (data.root || null) : null;
            return this.available;
        } catch { return false; }
    }

    async initSession() {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/init`, {
                method: 'POST',
                headers: { 'X-PHOI-App-Secret': this.appSecret || '' }
            });
            if (!res.ok) {
                this.available = false; // init 失败（无 app_secret），标记后端不可用
                return false;
            }
            const data = await res.json();
            this.token = data.token;
            sessionStorage.setItem('phoi_storage_token', this.token);
            return true;
        } catch {
            this.available = false;
            return false;
        }
    }

    _headers() {
        return {
            'Content-Type': 'application/json',
            'X-PHOI-Storage-Token': this.token
        };
    }

    async selectDir() {
        const res = await fetch(`${this.baseUrl}/api/storage/select-dir`, {
            method: 'POST', headers: this._headers()
        });
        if (!res.ok) return null;
        const data = await res.json();
        this.root = data.path;
        return data.path;
    }

    async listFiles() {
        const res = await fetch(`${this.baseUrl}/api/storage/list`, {
            method: 'POST', headers: this._headers()
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.files || [];
    }

    async readFile(fileName) {
        const res = await fetch(`${this.baseUrl}/api/storage/read`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ fileName })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.content;
    }

    async writeFile(fileName, content) {
        const res = await fetch(`${this.baseUrl}/api/storage/write`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ fileName, content })
        });
        return res.ok;
    }

    async deleteFile(fileName) {
        const res = await fetch(`${this.baseUrl}/api/storage/delete`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ fileName })
        });
        return res.ok;
    }

    async verifyToken() {
        try {
            const res = await fetch(`${this.baseUrl}/api/storage/ping`, {
                method: 'POST', headers: this._headers()
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async rememberRoot(path) {
        try {
            await fetch(`${this.baseUrl}/api/storage/remember-root`, {
                method: 'POST', headers: this._headers(),
                body: JSON.stringify({ path })
            });
        } catch { /* 非关键，失败不影响使用 */ }
    }
}

// 实例化存储后端
const storageBackend = new StorageBackend();

/**
 * 确保存储后端就绪：如果启用了本地存储且后端可用但没有文件夹，弹出选择对话框。
 * 返回 true 表示可以继续使用后端。
 */
async function ensureBackendReady() {
    if (!useNativeFS || !storageBackend.available || !storageBackend.token) return false;
    if (storageBackend.root) return true;
    // 回话恢复：从 localStorage 恢复储存路径
    const savedRoot = localStorage.getItem('phoi_storage_root');
    if (savedRoot) {
        storageBackend.root = savedRoot;
        await storageBackend.rememberRoot(savedRoot).catch(() => {});
        return true;
    }
    const path = await storageBackend.selectDir();
    if (!path) {
        // 用户取消选择，降级到浏览器存储
        useNativeFS = false;
        localStorage.setItem('phoi_useNativeFS', 'false');
        if (typeof showMessage === 'function') {
            showMessage('未选择文件夹，已回退到浏览器存储', 'system');
        }
        return false;
    }
    // 记住路径
    localStorage.setItem('phoi_storage_root', path);
    await storageBackend.rememberRoot(path);
    await renderVFS();
    return true;
}

// 实例化文件系统管理器
const fsManager = new FileSystemManager();

// 初始化 VFS 模块
async function initVFSModule() {
    // 如果启用了本地存储，自动检测最佳后端
    if (useNativeFS) {
        const backendOk = await storageBackend.checkAvailability();
        if (backendOk) {
            const savedToken = sessionStorage.getItem('phoi_storage_token');
            if (savedToken) {
                storageBackend.token = savedToken;
            } else {
                await storageBackend.initSession();
            }
            // 验证 token 是否真的可用（服务器重启后旧 token 会失效）
            if (storageBackend.token && storageBackend.available) {
                const valid = await storageBackend.verifyToken();
                if (!valid) {
                    // 旧 token 失效（服务器重启），重新申请新 token
                    storageBackend.token = null;
                    sessionStorage.removeItem('phoi_storage_token');
                    await storageBackend.initSession();
                }
            }
        }
    }

    // 检查是否启用了本地文件系统
    if (useNativeFS && 'showDirectoryPicker' in window && !fsManager.rootDir && !storageBackend.available) {
        // 浏览器 FS API 模式
        showPermissionRequestModal(false);
    } else if (useNativeFS && storageBackend.available && storageBackend.token && !storageBackend.root) {
        // Python 后端模式（有后端且有 token，但未选文件夹）
        showPermissionRequestModal(true);
    } else {
        // 初始化虚拟文件系统
        initializeVFS();
        await renderVFS();
        setupEventListeners();
        updateCurrentFileNameDisplay();
    }
}


// 显示权限请求弹窗
function showPermissionRequestModal(backendMode) {
    backendMode = backendMode === true; // 确保 boolean
    const colors = getVFSColors();
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'permission-request-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // 创建弹窗内容
    const modal = document.createElement('div');
    modal.id = 'permission-request-modal';
    modal.style.backgroundColor = colors.bg;
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'center';
    modal.style.maxWidth = '400px';
    modal.style.width = '80%';
    modal.style.color = colors.text;

    if (backendMode) {
        // ── 本地储存后端模式 ─────────────────────────────────
        const title = document.createElement('h3');
        title.textContent = '本地储存';
        title.style.color = colors.textWhite;
        title.style.marginTop = '0';
        modal.appendChild(title);

        const message = document.createElement('p');
        message.textContent = '已连接到本地储存后端，请选择储存方式：';
        message.style.marginBottom = '20px';
        message.style.lineHeight = '1.5';
        modal.appendChild(message);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        const selectFolderBtn = document.createElement('button');
        selectFolderBtn.textContent = '选择本地文件夹';
        selectFolderBtn.style.backgroundColor = colors.btnPrimary;
        selectFolderBtn.style.color = 'white';
        selectFolderBtn.style.border = 'none';
        selectFolderBtn.style.padding = '10px 20px';
        selectFolderBtn.style.borderRadius = '4px';
        selectFolderBtn.style.cursor = 'pointer';
        selectFolderBtn.style.fontSize = '14px';
        selectFolderBtn.onclick = async function() {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            const ready = await ensureBackendReady();
            if (ready) {
                initializeVFS();
                await renderVFS();
                setupEventListeners();
                updateCurrentFileNameDisplay();
            } else {
                // ensureBackendReady 已把 useNativeFS 设为 false，初始化 VFS
                initializeVFS();
                await renderVFS();
                setupEventListeners();
                updateCurrentFileNameDisplay();
            }
        };

        const useVirtualFSBtn = document.createElement('button');
        useVirtualFSBtn.textContent = '返回在线储存';
        useVirtualFSBtn.style.backgroundColor = colors.btnSecondary;
        useVirtualFSBtn.style.color = 'white';
        useVirtualFSBtn.style.border = 'none';
        useVirtualFSBtn.style.padding = '10px 20px';
        useVirtualFSBtn.style.borderRadius = '4px';
        useVirtualFSBtn.style.cursor = 'pointer';
        useVirtualFSBtn.style.fontSize = '14px';
        useVirtualFSBtn.onclick = async function() {
            useNativeFS = false;
            localStorage.setItem('phoi_useNativeFS', 'false');
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            initializeVFS();
            await renderVFS();
            setupEventListeners();
            updateCurrentFileNameDisplay();
        };

        buttonContainer.appendChild(selectFolderBtn);
        buttonContainer.appendChild(useVirtualFSBtn);
        modal.appendChild(buttonContainer);
    } else {
        // ── 浏览器 FS API 模式（原版逻辑）─────────────────
        // 添加标题
        const title = document.createElement('h3');
        title.textContent = '本地文件系统权限';
        title.style.color = colors.textWhite;
        title.style.marginTop = '0';
        modal.appendChild(title);

        // 添加说明文字
        const message = document.createElement('p');
        message.textContent = '您已启用本地文件系统功能，但尚未授权访问权限。请选择：';
        message.style.marginBottom = '20px';
        message.style.lineHeight = '1.5';
        modal.appendChild(message);

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        // 授权按钮
        const grantPermissionBtn = document.createElement('button');
        grantPermissionBtn.textContent = '授权本地文件访问';
        grantPermissionBtn.style.backgroundColor = colors.btnPrimary;
        grantPermissionBtn.style.color = 'white';
        grantPermissionBtn.style.border = 'none';
        grantPermissionBtn.style.padding = '10px 20px';
        grantPermissionBtn.style.borderRadius = '4px';
        grantPermissionBtn.style.cursor = 'pointer';
        grantPermissionBtn.style.fontSize = '14px';
        grantPermissionBtn.onclick = function() {
            // 使用setTimeout确保弹窗关闭操作在下一个事件循环执行
            setTimeout(() => {
                // 关闭弹窗
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                
                // 然后异步尝试获取权限
                requestNativeFSPermission()
                    .then(() => {
                        // 成功获取权限后，重新初始化文件系统
                        initializeVFS();
                        renderVFS();
                        setupEventListeners();
                        updateCurrentFileNameDisplay();
                    })
                    .catch(error => {
                        console.error('获取本地文件系统权限失败:', error);
                        if (window.PhoiDialog) {
                            PhoiDialog.alert('获取文件访问权限失败: ' + error.message);
                        } else {
                            alert('获取文件访问权限失败: ' + error.message);
                        }

                        // 即使失败也要确保界面更新
                        initializeVFS();
                        renderVFS();
                        setupEventListeners();
                        updateCurrentFileNameDisplay();
                    });
            }, 0);
        };

        // 返回虚拟文件系统按钮
        const useVirtualFSBtn = document.createElement('button');
        useVirtualFSBtn.textContent = '返回虚拟文件系统';
        useVirtualFSBtn.style.backgroundColor = colors.btnSecondary;
        useVirtualFSBtn.style.color = 'white';
        useVirtualFSBtn.style.border = 'none';
        useVirtualFSBtn.style.padding = '10px 20px';
        useVirtualFSBtn.style.borderRadius = '4px';
        useVirtualFSBtn.style.cursor = 'pointer';
        useVirtualFSBtn.style.fontSize = '14px';
        useVirtualFSBtn.onclick = async function() {
            // 禁用本地文件系统，使用虚拟文件系统
            useNativeFS = false;
            localStorage.setItem('phoi_useNativeFS', 'false');
            // 关闭弹窗并初始化虚拟文件系统
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            initializeVFS();
            await renderVFS();
            setupEventListeners();
            updateCurrentFileNameDisplay();
        };

        buttonContainer.appendChild(grantPermissionBtn);
        buttonContainer.appendChild(useVirtualFSBtn);
        modal.appendChild(buttonContainer);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}



// 初始化虚拟文件系统
function initializeVFS() {
    // 尝试从本地存储加载虚拟文件系统
    const savedVFS = localStorage.getItem(VFS_STORAGE_KEY);

    if (savedVFS) {
        // 如果已有虚拟文件系统，则加载它
        vfsStructure = JSON.parse(savedVFS);
    } else {
        // 否则初始化一个新的虚拟文件系统
        vfsStructure = {
            '/': {
                type: 'folder',
                name: 'root',
                children: {}
            }
        };

        // 检查是否有保存的代码但 VFS 中没有对应的文件
        // 这通常发生在新用户首次使用时
        const savedCode = localStorage.getItem('phoi_savedCode');
        const currentFile = localStorage.getItem('phoi_currentFileName') || 'new.cpp';
        
        // 如果 VFS 为空但有保存的代码，或者当前文件不存在于 VFS 中
        // 则创建该文件并保存代码
        if (!vfsStructure['/'].children[currentFile]) {
            const codeToSave = savedCode || (localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`);
            
            vfsStructure['/'].children[currentFile] = {
                type: 'file',
                name: currentFile,
                content: codeToSave
            };
            
            // 保存到本地存储
            localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
        } else {
            // 保存到本地存储
            localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
        }
    }
}

// 保存虚拟文件系统到本地存储
function saveVFS() {
    localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
}

// 渲染虚拟文件系统
async function renderVFS() {
    if (!window.vfsContent) return; // 如果元素不存在则返回

    // 清空内容
    window.vfsContent.innerHTML = '';

    // 创建操作按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderBottom = '1px solid #444';

    const newFileButton = document.createElement('button');
    newFileButton.textContent = '+ 文件';
    newFileButton.onclick = newFile;

    buttonContainer.appendChild(newFileButton);
    window.vfsContent.appendChild(buttonContainer);

    // 创建根目录项
    const rootDiv = document.createElement('div');
    rootDiv.className = 'vfs-folder';
    rootDiv.textContent = '根目录';
    rootDiv.dataset.path = '/';
    // 为根目录添加点击事件
    rootDiv.addEventListener('click', function() {
        console.log('展开根目录');
    });
    window.vfsContent.appendChild(rootDiv);

    // 渲染根目录下的所有子项
    await renderVFSDirectory('/', window.vfsContent);
}

// 打开文件
async function openFile(filePath) {
    // 从虚拟文件系统中获取文件内容
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // 检查文件是否存在
    let fileExists = false;
    
    if (useNativeFS && storageBackend.available && storageBackend.root) {
        // 通过 Python 后端检查
        try {
            const list = await storageBackend.listFiles();
            fileExists = hasFile(list, fileName);
        } catch { fileExists = false; }
    } else if (useNativeFS && 'showDirectoryPicker' in window) {
        // 检查本地文件系统
        try {
            if (!fsManager.rootDir) {
                // 注意：在打开文件时不能请求目录访问，因为这需要用户手势
                // 我们只在实际需要访问文件时才请求
                console.log('本地文件系统尚未初始化，请先执行文件操作以授权访问');
                fileExists = false;
            } else {
                const fileList = await fsManager.getFileList();
                fileExists = hasFile(fileList, fileName);
            }
        } catch (error) {
            console.error('检查本地文件存在性失败:', error);
        }
    } else {
        // 检查虚拟文件系统
        fileExists = vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file';
    }

    if (!fileExists) {
        fileExists = vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file';
    }

    if (fileExists) {
        // 通知主应用打开文件
        if (window.PhoiAPI && typeof window.PhoiAPI.openFile === 'function') {
            const success = await window.PhoiAPI.openFile(fileName);
            
            if (success) {
                // 关闭虚拟文件系统面板
                if (window.vfsPanel) {
                    window.vfsPanel.style.display = 'none';
                }
                if (window.sidebarToggle) {
                    window.sidebarToggle.classList.remove('vfs-open');
                }
            }
            
            return success;
        }
    }
}

// 渲染指定路径的目录
async function renderVFSDirectory(path, parentElement) {
    if (!parentElement) return; // 如果父元素不存在则返回
    const colors = getVFSColors();

    let files = [];

    // Python 后端优先
    if (useNativeFS && storageBackend.available) {
        if (storageBackend.root) {
            try {
                files = await storageBackend.listFiles();
            } catch (e) {
                console.warn('存储后端列表失败:', e);
            }
        } else {
            // 后端可用但未选文件夹 → 显示可点击的选择提示
            const container = document.createElement('div');
            container.className = 'vfs-subfolder';
            container.style.paddingLeft = '16px';

            const selectItem = document.createElement('div');
            selectItem.className = 'vfs-file';
            selectItem.style.color = colors.textWarning;
            selectItem.style.display = 'flex';
            selectItem.style.justifyContent = 'space-between';
            selectItem.style.alignItems = 'center';
            selectItem.style.padding = '5px';
            selectItem.style.cursor = 'pointer';
            selectItem.style.fontStyle = 'italic';

            const selectText = document.createElement('span');
            selectText.textContent = '（点击选择本地文件夹）';
            selectText.style.flexGrow = '1';
            selectItem.appendChild(selectText);
            selectItem.addEventListener('click', async function(e) {
                e.stopPropagation();
                const ready = await ensureBackendReady();
                if (ready) renderVFS();
            });

            container.appendChild(selectItem);
            parentElement.appendChild(container);
            return;
        }
    } else if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                // 显示提示信息，但不提供点击授权功能
                const container = document.createElement('div');
                container.className = 'vfs-subfolder';
                container.style.paddingLeft = '16px';

                const permissionItem = document.createElement('div');
                permissionItem.className = 'vfs-file';
                permissionItem.style.color = colors.textWarning; // 使用黄色表示提醒
                permissionItem.style.display = 'flex';
                permissionItem.style.justifyContent = 'space-between';
                permissionItem.style.alignItems = 'center';
                permissionItem.style.padding = '5px';
                permissionItem.style.cursor = 'default'; // 不可点击
                permissionItem.style.fontStyle = 'italic';

                const permissionText = document.createElement('span');
                permissionText.textContent = '（暂无权限，请在设置中启用）';
                permissionText.style.flexGrow = '1';
                permissionItem.appendChild(permissionText);

                container.appendChild(permissionItem);
                parentElement.appendChild(container);
                return; // 提前返回，不继续渲染其他内容
            } else {
                files = await fsManager.getFileList();
            }
        } catch (error) {
            console.error('获取本地文件列表失败:', error);
        }
    } else {
        // 使用虚拟文件系统
        const folder = vfsStructure[path];
        if (!folder || folder.type !== 'folder') return;
        
        for (const itemName in folder.children) {
            const item = folder.children[itemName];
            if (item.type === 'file') {
                files.push(item);
            }
        }
    }

    const container = document.createElement('div');
    container.className = 'vfs-subfolder';
    container.style.paddingLeft = '16px';

    for (const item of files) {
        // 处理文件对象（来自虚拟文件系统）或文件名（来自本地文件系统）
        const itemName = typeof item === 'string' ? item : item.name;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'vfs-file';
        itemElement.style.color = colors.textWhite; // 设置文字为白色
        itemElement.style.display = 'flex';
        itemElement.style.justifyContent = 'space-between';
        itemElement.style.alignItems = 'center';
        itemElement.style.padding = '5px';
        itemElement.style.cursor = 'pointer';

        // 文件名部分
        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = itemName;
        fileNameSpan.style.flexGrow = '1';
        itemElement.appendChild(fileNameSpan);

        // 删除按钮
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.style.backgroundColor = colors.btnDanger;
        deleteButton.style.color = 'white';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '50%';
        deleteButton.style.width = '20px';
        deleteButton.style.height = '20px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.onclick = function(e) {
            e.stopPropagation(); // 阻止事件冒泡到父元素
            deleteFile(itemName);
        };
        itemElement.appendChild(deleteButton);

        itemElement.dataset.path = path + itemName;

        // 为每个项目添加点击事件
        itemElement.addEventListener('click', function(e) {
            if (e.target !== deleteButton) { // 只有当点击的不是删除按钮时才打开文件
                const itemPath = this.dataset.path;
                openFile(itemPath);
            }
        });

        container.appendChild(itemElement);
    }

    parentElement.appendChild(container);
}

// 删除文件
async function deleteFile(fileName) {
    // 检查是否是当前正在使用的文件
    if (window.PhoiAPI && window.PhoiAPI.getCurrentFileName && fileName === window.PhoiAPI.getCurrentFileName()) {
        if (window.PhoiDialog) {
            await PhoiDialog.alert(`无法删除当前正在使用的文件 "${fileName}"`);
        } else {
            alert(`无法删除当前正在使用的文件 "${fileName}"`);
        }
        return;
    }

    let shouldDelete = false;
    if (window.PhoiDialog) {
        shouldDelete = await PhoiDialog.confirm(`确定要删除文件 "${fileName}" 吗？`);
    } else {
        shouldDelete = confirm(`确定要删除文件 "${fileName}" 吗？`);
    }

    if (shouldDelete) {
        // 后端优先
        if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
            if (await storageBackend.deleteFile(fileName)) {
                await renderVFS();
                if (typeof showMessage === 'function') {
                    showMessage(`文件 "${fileName}" 已删除`, 'user');
                }
                return;
            }
            console.warn('存储后端删除失败，降级');
        }

        if (useNativeFS && 'showDirectoryPicker' in window) {
            // 使用本地文件系统
            try {
                if (!fsManager.rootDir) {
                    await fsManager.requestDirectoryAccess();
                }
                await fsManager.deleteFile(fileName);
                await renderVFS(); // 重新渲染文件列表
                
                // 发送消息
                if (typeof showMessage === 'function') {
                    showMessage(`文件 "${fileName}" 已删除`, 'user');
                } else {
                    console.log(`文件 "${fileName}" 已删除`);
                }
            } catch (error) {
                console.error('删除本地文件失败:', error);
            }
        } else {
            // 从虚拟文件系统中删除文件
            delete vfsStructure['/'].children[fileName];

            saveVFS();
            await renderVFS();

            // 发送消息
            if (typeof showMessage === 'function') {
                showMessage(`文件 "${fileName}" 已删除`, 'user');
            } else {
                console.log(`文件 "${fileName}" 已删除`);
            }
        }
    }
}

// 切换虚拟文件系统面板显示状态
async function toggleVFSPanel() {
    if (!window.vfsPanel || !window.sidebarToggle) return; // 如果元素不存在则返回

    if (window.vfsPanel.style.display === 'none' || window.vfsPanel.style.display === '') {
        window.vfsPanel.style.display = 'flex';
        window.sidebarToggle.classList.add('vfs-open');
        await renderVFS(); // 确保文件列表最新
    } else {
        window.vfsPanel.style.display = 'none';
        window.sidebarToggle.classList.remove('vfs-open');
    }
}

// 上传文件到虚拟文件系统
async function uploadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async event => {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = async function(e) {
            const content = e.target.result;
            const fileName = file.name;

            // 后端优先
            if (await ensureBackendReady()) {
                if (await storageBackend.writeFile(fileName, content)) {
                    await renderVFS();
                    openFile(fileName);
                    return;
                }
                console.warn('存储后端上传失败，降级');
            }

            if (useNativeFS && 'showDirectoryPicker' in window) {
                try {
                    if (!fsManager.rootDir) {
                        await fsManager.requestDirectoryAccess();
                    }
                    await fsManager.createFile(fileName, content);
                    await renderVFS();
                    openFile(fileName);
                    return;
                } catch (error) {
                    console.error('本地文件系统上传失败:', error);
                }
            }

            // 将文件添加到虚拟文件系统
            vfsStructure['/'].children[fileName] = {
                type: 'file',
                name: fileName,
                content: content
            };

            saveVFS();
            await renderVFS();

            // 自动打开刚上传的文件
            openFile(fileName);
        };

        reader.readAsText(file);
    };

    input.click();
}

// 下载当前活动文件
function downloadCurrentFile() {
    if (window.PhoiAPI && window.PhoiAPI.getCurrentFileContent && window.PhoiAPI.getCurrentFileName) {
        const content = window.PhoiAPI.getCurrentFileContent();
        const fileName = window.PhoiAPI.getCurrentFileName() || 'current.cpp';

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}

// 另存为当前文件
async function saveCurrentFileAs() {
    if (!window.PhoiAPI || !window.PhoiAPI.getCurrentFileContent) {
        console.error('PhoiAPI未正确初始化');
        return;
    }

    const currentContent = window.PhoiAPI.getCurrentFileContent();
    
    let fileName;
    if (window.PhoiDialog) {
        fileName = await PhoiDialog.prompt('请输入文件名:', 'new_file.cpp');
    } else {
        fileName = prompt('请输入文件名:', 'new_file.cpp');
    }
    
    if (!fileName) return;

    // 后端优先
    if (await ensureBackendReady()) {
        if (await storageBackend.writeFile(fileName, currentContent)) {
            if (window.PhoiAPI.setCurrentFileName) {
                window.PhoiAPI.setCurrentFileName(fileName);
            }
            await renderVFS();
            showMessage(`文件已另存为: ${fileName}`, 'user');
            return;
        }
        console.warn('存储后端另存为失败，降级');
    }

    // 将当前代码保存为新文件
    vfsStructure['/'].children[fileName] = {
        type: 'file',
        name: fileName,
        content: currentContent
    };

    saveVFS();
    await renderVFS();

    // 通知主应用更新当前文件名
    if (window.PhoiAPI.setCurrentFileName) {
        window.PhoiAPI.setCurrentFileName(fileName);
    }

    // 发送消息
    if (typeof showMessage === 'function') {
        showMessage(`文件已另存为: ${fileName}`, 'user');
    } else {
        console.log(`文件已另存为: ${fileName}`);
    }
}

// 新建文件
async function newFile() {
    let fileName;
    if (window.PhoiDialog) {
        fileName = await PhoiDialog.prompt('请输入文件名:', 'new.cpp');
    } else {
        fileName = prompt('请输入文件名:', 'new.cpp');
    }
    
    if (!fileName) return;

    // 后端优先
    if (await ensureBackendReady()) {
        const list = await storageBackend.listFiles();
        const existingFile = findFileInList(list, fileName);
        if (existingFile) {
            openFile(existingFile);
            return;
        }
        const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;
        if (await storageBackend.writeFile(fileName, defaultCode)) {
            await renderVFS();
            openFile(fileName);
            return;
        }
        console.warn('存储后端创建文件失败，降级');
    }

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            // 检查文件是否已存在
            const fileList = await fsManager.getFileList();
            if (hasFile(fileList, fileName)) {
                if (window.PhoiDialog) {
                    await PhoiDialog.alert('文件已存在！');
                } else {
                    alert('文件已存在！');
                }
                return;
            }

            // 获取当前的默认代码（可能是用户自定义的）
            const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;

            // 创建新文件
            await fsManager.createFile(fileName, defaultCode);

            await renderVFS(); // 重新渲染文件列表

            // 自动打开新创建的文件
            openFile(fileName);
        } catch (error) {
            console.error('在本地文件系统中创建文件失败:', error);
        }
    } else {
        // 使用虚拟文件系统
        // 检查文件是否已存在
        if (vfsStructure['/'].children[fileName]) {
            if (window.PhoiDialog) {
                await PhoiDialog.alert('文件已存在！');
            } else {
                alert('文件已存在！');
            }
            return;
        }

        // 获取当前的默认代码（可能是用户自定义的）
        const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;

        // 创建新文件
        vfsStructure['/'].children[fileName] = {
            type: 'file',
            name: fileName,
            content: defaultCode
        };

        saveVFS();
        await renderVFS();

        // 自动打开新创建的文件
        openFile(fileName);
    }
}


// 保存文件到虚拟文件系统
async function saveFileToVFS(fileName, content) {
    if (!fileName) return;

    // 后端优先：如果启用了本地存储且 Python 后端可用
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        if (await storageBackend.writeFile(fileName, content)) return;
        // 写入失败，降级
        console.warn('存储后端写入失败，降级');
    }

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            await fsManager.saveFile(fileName, content);
        } catch (error) {
            console.error('保存到本地文件系统失败:', error);
            // 如果是权限错误，自动回退到虚拟文件系统
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message);
                // 并使用虚拟文件系统保存
                if (!vfsStructure['/'].children[fileName]) {
                    // 如果文件不存在，创建新文件
                    vfsStructure['/'].children[fileName] = {
                        type: 'file',
                        name: fileName,
                        content: content
                    };
                } else {
                    // 更新现有文件内容
                    vfsStructure['/'].children[fileName].content = content;
                }
                saveVFS();
            }
        }
    } else {
        // 使用虚拟文件系统
        if (!vfsStructure['/'].children[fileName]) {
            // 如果文件不存在，创建新文件
            vfsStructure['/'].children[fileName] = {
                type: 'file',
                name: fileName,
                content: content
            };
        } else {
            // 更新现有文件内容
            vfsStructure['/'].children[fileName].content = content;
        }
        saveVFS();
    }
}

// 获取文件内容
async function getFileContent(fileName) {
    // 后端优先
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        const content = await storageBackend.readFile(fileName);
        if (content !== null) return content;
        console.warn('存储后端读取失败，降级');
    }

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            const content = await fsManager.getFileContent(fileName);
            if (content !== null) {
                return content;
            }
        } catch (error) {
            console.error('从本地文件系统读取失败:', error);
            // 如果是权限错误，自动回退到虚拟文件系统
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message);
                // 并使用虚拟文件系统读取
                useNativeFS = false; // 临时禁用本地文件系统标志
            }
        }
        return null;
    }
    
    // 使用虚拟文件系统
    if (vfsStructure && vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file') {
        return vfsStructure['/'].children[fileName].content;
    }
    // 文件不存在，检查是否在localStorage中有该文件
    const fileKey = `phoi_file_${fileName}`;
    const fileContent = localStorage.getItem(fileKey);

    if (fileContent !== null) {
        // 文件存在于localStorage中，将其添加到VFS
        vfsStructure['/'].children[fileName] = {
            type: 'file',
            name: fileName,
            content: fileContent
        };

        // 保存VFS结构
        saveVFS();
        
        return fileContent;
    }
    
    return null;
}

// 创建新文件
async function createNewFile(fileName, content = '') {
    const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;
    const fileContent = content || defaultCode;

    // 后端优先
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        const list = await storageBackend.listFiles();
        const existingFile = findFileInList(list, fileName);
        if (existingFile) {
            return PhoiAPI_openFile(existingFile);
        }
        if (await storageBackend.writeFile(fileName, fileContent)) {
            await renderVFS();
            return PhoiAPI_openFile(fileName);
        }
        console.warn('存储后端创建文件失败，降级');
    }

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            const fileList = await fsManager.getFileList();
            const existingFile = findFileInList(fileList, fileName);
            if (existingFile) {
                return PhoiAPI_openFile(existingFile);
            }

            await fsManager.createFile(fileName, fileContent);
            return PhoiAPI_openFile(fileName);
        } catch (error) {
            console.error('在本地文件系统中创建文件失败:', error);
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message);
                useNativeFS = false;
            } else {
                console.log('由于错误，回退到虚拟文件系统');
                useNativeFS = false;
                localStorage.setItem('phoi_useNativeFS', 'false');
            }
        }
    }

    // 使用虚拟文件系统
    const lowerName = fileName.toLowerCase();
    const existingVFS = Object.keys(vfsStructure['/'].children).find(k => k.toLowerCase() === lowerName);
    if (existingVFS) {
        return PhoiAPI_openFile(existingVFS);
    }

    vfsStructure['/'].children[fileName] = {
        type: 'file',
        name: fileName,
        content: fileContent
    };

    saveVFS();
    await renderVFS();
    return PhoiAPI_openFile(fileName);
}

function PhoiAPI_openFile(fileName) {
    if (typeof window.PhoiAPI !== 'undefined' && typeof window.PhoiAPI.openFile === 'function') {
        return window.PhoiAPI.openFile(fileName);
    }
    return openFile(fileName);
}

// 获取所有文件列表
async function getFileList() {
    // 后端优先
    if (useNativeFS && storageBackend.available && await ensureBackendReady()) {
        try {
            return await storageBackend.listFiles();
        } catch {
            console.warn('存储后端列表失败，降级');
        }
    }

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            return fsManager.getFileList();
        } catch (error) {
            console.error('获取本地文件列表失败:', error);
            // 回退到虚拟文件系统
        }
    }
    
    // 使用虚拟文件系统
    if (!vfsStructure) return [];
    return Object.keys(vfsStructure['/'].children).filter(key => {
        return vfsStructure['/'].children[key].type === 'file';
    });
}

// 更新顶部菜单栏中显示的当前文件名
function updateCurrentFileNameDisplay() {
    const currentFileNameElement = document.getElementById('current-file-name');
    if (currentFileNameElement) {
        currentFileNameElement.textContent = currentFileName;
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 虚拟文件系统关闭按钮 - 需要检查元素是否存在
    if (window.vfsCloseBtn) {
        window.vfsCloseBtn.addEventListener('click', function() {
            if (window.vfsPanel) {
                window.vfsPanel.style.display = 'none';
            }
            if (window.sidebarToggle) {
                // 移除CSS类来表示面板关闭状态，而不是修改文本内容
                window.sidebarToggle.classList.remove('vfs-open');
            }
        });
    }
    
    // 为侧边栏切换按钮添加事件监听器
    if (window.sidebarToggle) {
        window.sidebarToggle.addEventListener('click', toggleVFSPanel);
    }
}

// 请求本地文件系统权限
async function requestNativeFSPermission() {
    try {
        // 尝试获取目录访问权限
        await fsManager.requestDirectoryAccess();

        // 尝试创建一个测试文件
        await fsManager.createFile('!phcode.test', 'This is a test file for phcode permissions.');

        // 立即删除测试文件
        await fsManager.deleteFile('!phcode.test');

        // 检查是否存在权限请求弹窗，如果有则关闭它
        const permissionOverlay = document.getElementById('permission-request-overlay');
        if (permissionOverlay && document.body.contains(permissionOverlay)) {
            document.body.removeChild(permissionOverlay);
        }

        console.log('本地文件系统权限已成功获取');
    } catch (error) {
        console.error('请求本地文件系统权限失败:', error);
        // 自动回退到虚拟文件系统并显示通知
        fallbackToVirtualFS(error.message);
        throw error;
    }
}

// 自动回退到虚拟文件系统
async function fallbackToVirtualFS(errorMessage = '') {
    // 禁用本地文件系统，使用虚拟文件系统
    useNativeFS = false;
    localStorage.setItem('phoi_useNativeFS', 'false');
    
    // 显示通知给用户
    showFallbackNotification(errorMessage);
    
    // 重新初始化文件系统
    if (typeof initializeVFS === 'function') {
        initializeVFS();
    }
    if (typeof renderVFS === 'function') {
        await renderVFS();
    }
    if (typeof setupEventListeners === 'function') {
        setupEventListeners();
    }
    if (typeof updateCurrentFileNameDisplay === 'function') {
        updateCurrentFileNameDisplay();
    }
}

// 显示回退通知
function showFallbackNotification(errorMessage = '') {
    const colors = getVFSColors();
    // 创建通知弹窗
    const notification = document.createElement('div');
    notification.id = 'fallback-notification';
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = colors.btnDanger;
    notification.style.color = 'white';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '10001';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    notification.style.maxWidth = '400px';
    notification.style.wordWrap = 'break-word';
    notification.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold;">本地文件系统授权问题</div>
        <div>已自动回退到虚拟文件系统</div>
        ${errorMessage ? `<div style="margin-top: 8px; font-size: 0.9em; opacity: 0.8;">错误: ${errorMessage}</div>` : ''}
    `;
    
    // 添加关闭按钮
    const closeButton = document.createElement('span');
    closeButton.innerHTML = '&times;';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '10px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';
    closeButton.onclick = function() {
        document.body.removeChild(notification);
    };
    
    notification.appendChild(closeButton);
    document.body.appendChild(notification);
    
    // 3秒后自动隐藏
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

// 导出函数以供外部使用
if (typeof window !== 'undefined') {
    // 在浏览器环境中，将函数附加到window对象
    window.vfsModule = {
        initVFSModule,
        initializeVFS,
        saveVFS,
        renderVFS,
        openFile,
        deleteFile,
        toggleVFSPanel,
        uploadFile,
        downloadCurrentFile,
        saveCurrentFileAs,
        newFile,
        saveFileToVFS,
        getFileContent,
        createNewFile,
        getFileList,
        getStorageBackend: function() { return storageBackend; },
        getCurrentFileName: function() {
            return currentFileName;
        },
        setCurrentFileName: function(fileName) {
            currentFileName = fileName;
            localStorage.setItem('phoi_currentFileName', currentFileName);
            updateCurrentFileNameDisplay();
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initVFSModule,
        initializeVFS,
        saveVFS,
        renderVFS,
        openFile,
        deleteFile,
        toggleVFSPanel,
        uploadFile,
        downloadCurrentFile,
        saveCurrentFileAs,
        newFile,
        saveFileToVFS,
        getFileContent,
        createNewFile,
        getFileList
    };
}