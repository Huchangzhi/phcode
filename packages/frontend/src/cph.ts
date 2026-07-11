const CPH_STORAGE_KEY_PREFIX = 'phoi_cph_testcases_';

interface TestCase {
    stdin: string
    stdout: string
    name: string
}

class CPHPlugin {
    currentFile: string
    testCases: TestCase[] = []

    constructor() {
        this.currentFile = localStorage.getItem('phoi_currentFileName') || 'new.cpp'
        this.testCases = this.loadTestCases()
        this.bindEvents()
        this.initSidebarButton()
    }

    private loadTestCases(): TestCase[] {
        try {
            const storageKey = CPH_STORAGE_KEY_PREFIX + this.currentFile
            const savedTestCases = localStorage.getItem(storageKey)
            return savedTestCases ? JSON.parse(savedTestCases) : []
        } catch (e) {
            console.error('CPH: 加载测试用例失败', e)
            return []
        }
    }

    saveTestCases(): void {
        try {
            const storageKey = CPH_STORAGE_KEY_PREFIX + this.currentFile
            localStorage.setItem(storageKey, JSON.stringify(this.testCases))
        } catch (e) {
            console.error('CPH: 保存测试用例失败', e)
        }
    }

    updateCurrentFile(): void {
        const newFile = localStorage.getItem('phoi_currentFileName') || 'new.cpp'
        if (newFile !== this.currentFile) {
            this.saveTestCases()
            this.currentFile = newFile
            this.testCases = this.loadTestCases()
            this.renderTestCases()
            this.renderTestCasesMain()
        }
    }

    private initSidebarButton(): void {
        const cphToggleBtn = document.getElementById('cph-plugin-toggle')
        if (!cphToggleBtn) return
        this.createCPHPanel()
        cphToggleBtn.addEventListener('click', () => {
            this.updateCurrentFile()
            this.toggleCPHPanel()
        })
    }

    private createCPHPanel(): void {
        if (document.getElementById('cph-panel')) return
        const cphPanel = document.createElement('div')
        cphPanel.id = 'cph-panel'
        cphPanel.className = 'vfs-panel'
        cphPanel.style.display = 'none'
        cphPanel.innerHTML = `
            <div class="vfs-header">
                <span>CPH - 测试用例管理</span>
                <button id="cph-close-btn" class="vfs-close-btn">×</button>
            </div>
            <div id="cph-content" class="vfs-content">
                <div class="cph-controls">
                    <button id="cph-add-test-case-main" class="btn-small">+ 新建测试点</button>
                    <button id="cph-run-all-btn" class="btn-small">▶ 运行全部测试点</button>
                    <button id="cph-manage-files-btn" class="btn-small">管理所有题目</button>
                </div>
                <div id="cph-test-cases-container-main" class="cph-test-cases-container"></div>
                <div id="cph-all-files-container" class="cph-all-files-container" style="display: none;">
                    <div class="cph-all-files-header">
                        <h3>所有题目</h3>
                        <button id="cph-back-to-current-btn" class="btn-small">返回当前题目</button>
                    </div>
                    <div id="cph-all-files-list" class="cph-all-files-list"></div>
                </div>
            </div>
        `
        document.body.appendChild(cphPanel)
        document.getElementById('cph-close-btn')?.addEventListener('click', () => this.hideCPHPanel())
        document.getElementById('cph-add-test-case-main')?.addEventListener('click', () => this.addTestCase())
        document.getElementById('cph-run-all-btn')?.addEventListener('click', () => this.runAllTests())
        document.getElementById('cph-manage-files-btn')?.addEventListener('click', () => this.showManageFilesView())
        document.getElementById('cph-back-to-current-btn')?.addEventListener('click', () => this.showTestCaseView())
        const cphContent = document.getElementById('cph-content')
        const enableCustomTouchScroll = (window as any)._enableCustomTouchScroll
        if (cphContent && typeof enableCustomTouchScroll === 'function') {
            enableCustomTouchScroll(cphContent)
        }
    }

    showCPHPanel(): void {
        this.updateCurrentFile()
        const panel = document.getElementById('cph-panel')
        if (panel) {
            panel.style.display = 'flex'
            const btn = document.getElementById('cph-plugin-toggle')
            if (btn) btn.classList.add('active', 'cph-open')
            this.renderTestCasesMain()
        }
    }

    hideCPHPanel(): void {
        const panel = document.getElementById('cph-panel')
        if (panel) {
            panel.style.display = 'none'
            const btn = document.getElementById('cph-plugin-toggle')
            if (btn) btn.classList.remove('active', 'cph-open')
        }
    }

    toggleCPHPanel(): void {
        const panel = document.getElementById('cph-panel')
        if (panel) {
            if (panel.style.display === 'none' || panel.style.display === '') {
                this.showCPHPanel()
            } else {
                this.hideCPHPanel()
            }
        }
    }

    private showManageFilesView(): void {
        const tc = document.getElementById('cph-test-cases-container-main')
        const afc = document.getElementById('cph-all-files-container')
        const addBtn = document.getElementById('cph-add-test-case-main')
        const runBtn = document.getElementById('cph-run-all-btn')
        if (tc) tc.style.display = 'none'
        if (afc) afc.style.display = 'block'
        if (addBtn) addBtn.style.display = 'none'
        if (runBtn) runBtn.style.display = 'none'
        this.renderAllFilesList()
    }

    private showTestCaseView(): void {
        const tc = document.getElementById('cph-test-cases-container-main')
        const afc = document.getElementById('cph-all-files-container')
        const addBtn = document.getElementById('cph-add-test-case-main')
        const runBtn = document.getElementById('cph-run-all-btn')
        if (tc) tc.style.display = 'block'
        if (afc) afc.style.display = 'none'
        if (addBtn) addBtn.style.display = 'block'
        if (runBtn) runBtn.style.display = 'block'
        this.renderTestCasesMain()
    }

    private getAllStoredFiles(): { key: string; fileName: string; testCases: TestCase[] }[] {
        const files: { key: string; fileName: string; testCases: TestCase[] }[] = []
        const prefix = CPH_STORAGE_KEY_PREFIX
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(prefix)) {
                const fileName = key.substring(prefix.length)
                try {
                    files.push({ key, fileName, testCases: JSON.parse(localStorage.getItem(key) || '[]') })
                } catch { files.push({ key, fileName, testCases: [] }) }
            }
        }
        return files
    }

    private renderAllFilesList(): void {
        const container = document.getElementById('cph-all-files-list')
        if (!container) return
        const files = this.getAllStoredFiles()
        if (files.length === 0) {
            container.innerHTML = '<div class="cph-empty-state">暂无存储的题目</div>'
            return
        }
        container.innerHTML = ''
        files.forEach(file => {
            const item = document.createElement('div')
            item.className = 'cph-file-item'
            item.innerHTML = `
                <div class="cph-file-header">
                    <span class="cph-file-name">${file.fileName}</span>
                    <div class="cph-file-actions">
                        <button class="cph-view-file-btn btn-small" data-filename="${file.fileName}">查看</button>
                        <button class="cph-delete-file-btn btn-small" data-filename="${file.fileName}">×</button>
                    </div>
                </div>
                <div class="cph-file-info">包含 ${file.testCases.length} 个测试用例</div>
            `
            container.appendChild(item)
        })
        container.querySelectorAll('.cph-view-file-btn').forEach(btn =>
            btn.addEventListener('click', (e: any) => this.viewFileTestCases(e.target.dataset.filename)))
        container.querySelectorAll('.cph-delete-file-btn').forEach(btn =>
            btn.addEventListener('click', (e: any) => this.deleteFileTestCases(e.target.dataset.filename)))
    }

    private viewFileTestCases(fileName: string): void {
        this.showTestCaseView()
        this.currentFile = fileName
        this.testCases = this.loadTestCasesForFile(fileName)
        this.renderTestCasesMain()
    }

    private loadTestCasesForFile(fileName: string): TestCase[] {
        try {
            const saved = localStorage.getItem(CPH_STORAGE_KEY_PREFIX + fileName)
            return saved ? JSON.parse(saved) : []
        } catch { return [] }
    }

    private async deleteFileTestCases(fileName: string): Promise<void> {
        const PhoiDialog = (window as any).PhoiDialog
        let shouldDelete = false
        if (PhoiDialog && typeof PhoiDialog.confirm === 'function') {
            shouldDelete = await PhoiDialog.confirm(`确定要删除 "${fileName}" 的所有测试用例吗？`)
        } else {
            shouldDelete = confirm(`确定要删除 "${fileName}" 的所有测试用例吗？`)
        }
        if (shouldDelete) {
            localStorage.removeItem(CPH_STORAGE_KEY_PREFIX + fileName)
            if (this.currentFile === fileName) {
                this.testCases = []
                this.renderTestCasesMain()
            }
            this.renderAllFilesList()
        }
    }

    private bindEvents(): void {
        document.addEventListener('click', (e: any) => {
            if (e.target.classList.contains('cph-delete-test-case-btn')) {
                this.deleteTestCase(parseInt(e.target.dataset.testCaseIndex))
            }
        })
        window.addEventListener('storage', (e: StorageEvent) => {
            if (e.key === 'phoi_currentFileName') this.updateCurrentFile()
        })
    }

    addTestCase(): void {
        this.testCases.push({ stdin: '', stdout: '', name: `测试点 ${this.testCases.length + 1}` })
        this.saveTestCases()
        this.renderTestCases()
        this.renderTestCasesMain()
    }

    async deleteTestCase(index: number): Promise<void> {
        if (index >= 0 && index < this.testCases.length) {
            const tc = this.testCases[index]
            const PhoiDialog = (window as any).PhoiDialog
            let confirmed = false
            if (PhoiDialog && typeof PhoiDialog.confirm === 'function') {
                confirmed = await PhoiDialog.confirm(`确定要删除 ${tc.name} 吗？`)
            } else {
                confirmed = confirm(`确定要删除 ${tc.name} 吗？`)
            }
            if (confirmed) {
                this.testCases.splice(index, 1)
                this.testCases.forEach((tc, i) => { tc.name = `测试点 ${i + 1}` })
                this.saveTestCases()
                this.renderTestCases()
                this.renderTestCasesMain()
            }
        }
    }

    renderTestCasesMain(): void {
        this.renderTestCases()
    }

    renderTestCases(): void {
        const container = document.getElementById('cph-test-cases-container-main')
        if (!container) return
        container.innerHTML = ''
        if (this.testCases.length === 0) {
            container.innerHTML = '<div class="cph-empty-state">暂无测试用例，请点击"新建测试点"创建</div>'
            return
        }
        this.testCases.forEach((testCase, index) => {
            const div = document.createElement('div')
            div.className = 'cph-test-case'
            div.innerHTML = `
                <div class="cph-test-case-header">
                    <span class="cph-test-case-name">${testCase.name}</span>
                    <div class="cph-test-case-actions">
                        <button class="cph-delete-test-case-btn btn-small" data-test-case-index="${index}">×</button>
                    </div>
                </div>
                <div class="cph-test-case-content">
                    <div class="cph-test-case-input">
                        <label>标准输入 (stdin):</label>
                        <textarea class="cph-test-case-textarea" data-test-case-index="${index}" data-type="stdin">${testCase.stdin || ''}</textarea>
                    </div>
                    <div class="cph-test-case-output">
                        <label>标准输出 (stdout):</label>
                        <textarea class="cph-test-case-textarea" data-test-case-index="${index}" data-type="stdout">${testCase.stdout || ''}</textarea>
                    </div>
                </div>
            `
            container.appendChild(div)
            div.querySelectorAll('.cph-test-case-textarea').forEach(ta =>
                ta.addEventListener('input', (e: any) => {
                    const idx = parseInt(e.target.dataset.testCaseIndex)
                    if (this.testCases[idx]) {
                        this.testCases[idx][e.target.dataset.type as 'stdin' | 'stdout'] = e.target.value
                        this.saveTestCases()
                    }
                }))
        })
    }

    async runAllTests(): Promise<void> {
        this.updateCurrentFile()
        if (this.testCases.length === 0) {
            const PhoiDialog = (window as any).PhoiDialog
            if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
                PhoiDialog.alert('请先添加测试用例！')
            } else {
                alert('请先添加测试用例！')
            }
            return
        }

        let code = ''
        const me = (window as any).monacoEditor
        if (me) {
            code = me.getValue()
        } else {
            code = (window as any).globalText || ''
        }

        if (!code.trim()) {
            const PhoiDialog = (window as any).PhoiDialog
            if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
                PhoiDialog.alert('请先编写代码！')
            } else {
                alert('请先编写代码！')
            }
            return
        }

        const terminalPanel = document.getElementById('terminal-panel')
        const terminalRunContent = document.getElementById('terminal-run-content')
        if (terminalPanel) {
            terminalPanel.style.display = 'flex'
        }
        const switchTerminalTab = (window as any).switchTerminalTab
        if (typeof switchTerminalTab === 'function') {
            switchTerminalTab('run')
        }

        if (terminalRunContent) {
            terminalRunContent.innerHTML = `<div class="debug-message system"><strong>系统:</strong> 开始运行 ${this.testCases.length} 个测试点...</div>`
        }

        let allPassed = true

        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i]
            const stdin = testCase.stdin || ''

            if (terminalRunContent) {
                terminalRunContent.innerHTML += `<div class="debug-message system"><strong>系统:</strong> 正在运行 ${testCase.name}...</div>`
                terminalRunContent.scrollTop = terminalRunContent.scrollHeight
            }

            try {
                const useLocal = localStorage.getItem('phoi_local_compile_enabled') === 'true'
                    && (window as any).LocalCompile && typeof (window as any).LocalCompile.isAvailable === 'function' && (window as any).LocalCompile.isAvailable()
                let result: any
                if (useLocal) {
                    result = await (window as any).LocalCompile.compileAndRun(code, stdin)
                } else {
                    const response = await fetch('/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, input: stdin })
                    })
                    result = await response.json()
                }

                let status = '✅ 通过'
                let message = ''

                if (result.Errors) {
                    const errorMsg = result.Errors.toLowerCase()
                    if (errorMsg.includes('runtime error') || errorMsg.includes('segmentation fault') ||
                        errorMsg.includes('abort') || errorMsg.includes('exit') || errorMsg.includes('exception') ||
                        errorMsg.includes('sigill') || errorMsg.includes('illegal instruction') ||
                        errorMsg.includes('sigsegv') || errorMsg.includes('sigabrt') ||
                        errorMsg.includes('sigfpe') || errorMsg.includes('floating point exception')) {
                        status = '❌ 运行时错误 (RE)'
                    } else if (errorMsg.includes('time limit') || errorMsg.includes('timeout') ||
                        errorMsg.includes('tle') || errorMsg.includes('exceeded') ||
                        errorMsg.includes('longer than') || errorMsg.includes('killed') ||
                        (errorMsg.includes('seconds') && errorMsg.includes('ran'))) {
                        status = '❌ 时间超限 (TLE)'
                    } else if (errorMsg.includes('memory limit') || errorMsg.includes('memory exceeded') ||
                        errorMsg.includes('mle') || errorMsg.includes('out of memory')) {
                        status = '❌ 内存超限 (MLE)'
                    } else {
                        status = '❌ 编译或其它错误'
                    }
                    message = result.Errors
                    allPassed = false
                } else if (result.Result) {
                    const normalizeWhitespace = (str: string) => {
                        return str.split('\n').map((line: string) => line.replace(/\s+$/, '')).join('\n').trim()
                    }
                    const actualOutput = normalizeWhitespace(result.Result)
                    const expectedOutput = normalizeWhitespace(testCase.stdout || '')
                    if (actualOutput === expectedOutput) {
                        status = '✅ 通过'
                    } else {
                        status = '❌ 输出不匹配'
                        message = `期望: "${expectedOutput}"\n实际: "${actualOutput}"`
                        allPassed = false
                    }
                } else {
                    status = '⚠️ 无输出'
                    allPassed = false
                }

                if (terminalRunContent) {
                    const resultDiv = document.createElement('div')
                    resultDiv.className = `debug-message ${status.includes('✅') && message === '' ? 'success' : status.includes('❌') ? 'error' : 'warning'}`
                    resultDiv.innerHTML = `<strong>${testCase.name}:</strong> ${status}${message ? `<br>${message.replace(/\n/g, '<br>')}` : ''}`
                    terminalRunContent.appendChild(resultDiv)
                    terminalRunContent.scrollTop = terminalRunContent.scrollHeight
                }

                await new Promise(resolve => setTimeout(resolve, 500))

            } catch (error: any) {
                allPassed = false
                if (terminalRunContent) {
                    terminalRunContent.innerHTML += `<div class="debug-message error"><strong>系统:</strong> ${testCase.name} 运行出错: ${error.message}</div>`
                    terminalRunContent.scrollTop = terminalRunContent.scrollHeight
                }
            }
        }

        if (terminalRunContent) {
            const summary = allPassed ? '🎉 全部通过！' : '❌ 存在未通过的测试点'
            terminalRunContent.innerHTML += `<div class="debug-message system"><strong>系统:</strong> 所有测试点运行完成！${summary}</div>`
            terminalRunContent.scrollTop = terminalRunContent.scrollHeight
        }
    }
}

const cphPlugin = new CPHPlugin()
;(window as any).cphPlugin = cphPlugin

async function handleCompetitiveCompanionData(data: any): Promise<void> {
    try {
        if (!data.success) {
            const PhoiDialog = (window as any).PhoiDialog
            if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
                await PhoiDialog.alert('接收数据失败: ' + (data.message || ''))
            } else {
                alert('接收数据失败: ' + (data.message || ''))
            }
            return
        }

        const filename = data.filename
        const tests = data.tests || []

        const PhoiAPI = (window as any).PhoiAPI
        if (PhoiAPI) {
            const fileList = await PhoiAPI.getFileList()
            const lower = filename.toLowerCase()
            const existingFile = fileList.find((f: string) => f.toLowerCase() === lower)
            if (existingFile) {
                await PhoiAPI.openFile(existingFile)
            } else {
                const defaultCode = localStorage.getItem('phoi_defaultCode') ||
                    '#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}'
                await PhoiAPI.createNewFile(filename, defaultCode)
                await PhoiAPI.openFile(filename)
            }
        } else {
            const PhoiDialog = (window as any).PhoiDialog
            if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
                await PhoiDialog.alert('系统错误: PhoiAPI未初始化')
            } else {
                alert('系统错误: PhoiAPI未初始化')
            }
            return
        }

        if (cphPlugin) {
            cphPlugin.currentFile = filename
            cphPlugin.testCases = []

            tests.forEach((test: any, index: number) => {
                cphPlugin.testCases.push({
                    stdin: test.input || '',
                    stdout: test.output || '',
                    name: `测试点 ${index + 1}`
                })
            })

            cphPlugin.saveTestCases()
            cphPlugin.renderTestCases()
            cphPlugin.showCPHPanel()

            const showMessage = (window as any).showMessage
            if (typeof showMessage === 'function') {
                showMessage(`已成功导入 "${data.name}" 的 ${tests.length} 个测试用例`, 'success')
            } else {
                const PhoiDialog = (window as any).PhoiDialog
                if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
                    await PhoiDialog.alert(`已成功导入 "${data.name}" 的 ${tests.length} 个测试用例`)
                } else {
                    alert(`已成功导入 "${data.name}" 的 ${tests.length} 个测试用例`)
                }
            }
        } else {
            const PhoiDialog = (window as any).PhoiDialog
            if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
                await PhoiDialog.alert('CPH插件未启用，请先在插件中心启用CPH插件')
            } else {
                alert('CPH插件未启用，请先在插件中心启用CPH插件')
            }
        }
    } catch (error: any) {
        const PhoiDialog = (window as any).PhoiDialog
        if (PhoiDialog && typeof PhoiDialog.alert === 'function') {
            await PhoiDialog.alert('处理数据时出错: ' + (error.message || error))
        } else {
            alert('处理数据时出错: ' + (error.message || error))
        }
    }
}

;(window as any).handleCompetitiveCompanionData = handleCompetitiveCompanionData

let companionPollFailureCount = 0
const MAX_COMPANION_FAILURES = 3
let companionPollInterval: ReturnType<typeof setInterval> | null = null

function checkCompetitiveCompanionData(): void {
    fetch('http://127.0.0.1:27121/data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                handleCompetitiveCompanionData(data)
                companionPollFailureCount = 0
            }
        })
        .catch(() => {
            companionPollFailureCount++
            if (companionPollFailureCount >= MAX_COMPANION_FAILURES) {
                console.log('Competitive Companion轮询失败次数过多，停止轮询')
                if (companionPollInterval) {
                    clearInterval(companionPollInterval)
                    companionPollInterval = null
                }
            }
        })
}

function startCompanionPolling(): void {
    if (companionPollInterval) return
    companionPollInterval = setInterval(checkCompetitiveCompanionData, 2000)
}

startCompanionPolling()

function stopCompanionPolling(): void {
    if (companionPollInterval) {
        clearInterval(companionPollInterval)
        companionPollInterval = null
    }
}

function initCPHPlugin(): void {
    const pluginSwitch = document.getElementById('cph-plugin-enabled') as HTMLInputElement | null
    if (pluginSwitch) {
        const savedState = localStorage.getItem('cph_plugin_enabled')
        if (savedState === null) {
            localStorage.setItem('cph_plugin_enabled', 'true')
            pluginSwitch.checked = true
        } else {
            pluginSwitch.checked = savedState === 'true'
        }

        pluginSwitch.addEventListener('change', function (this: HTMLInputElement) {
            localStorage.setItem('cph_plugin_enabled', String(this.checked))
            const cphButton = document.getElementById('cph-plugin-toggle')
            const cphPanel = document.getElementById('cph-panel')
            if (this.checked) {
                if (cphButton) cphButton.style.display = 'flex'
            } else {
                if (cphButton) cphButton.style.display = 'none'
                if (cphPanel) cphPanel.style.display = 'none'
            }
        })

        if (!pluginSwitch.checked) {
            const cphButton = document.getElementById('cph-plugin-toggle')
            if (cphButton) cphButton.style.display = 'none'
        }
    }

    startCompanionPolling()
}

try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCPHPlugin)
    } else {
        initCPHPlugin()
    }
} catch (e) {
    console.error('CPH init error:', e)
}

export { CPHPlugin, initCPHPlugin }
export { cphPlugin }
export { handleCompetitiveCompanionData }
export { startCompanionPolling, stopCompanionPolling }
