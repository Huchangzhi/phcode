interface LuoguColors {
    bg: string; bgAlt: string; bgHover: string; bgCode: string
    text: string; textSecondary: string; textMuted: string
    border: string; borderLight: string
    btnPrimary: string; btnSecondary: string; btnTranslate: string; btnTranslateHover: string
    btnDisabled: string; btnError: string; btnCph: string
    headingColor: string
    difficultyGray: string; difficultyRed: string; difficultyOrange: string; difficultyYellow: string
    difficultyGreen: string; difficultyBlue: string; difficultyPurple: string; difficultyDarkPurple: string
    loadingText: string; errorText: string; successText: string; warnText: string
}

interface SampleTuple { 0: string; 1: string }
interface ProblemData {
    pid: string; title: string; difficulty: number
    description?: string; inputFormat?: string; outputFormat?: string
    samples?: SampleTuple[]
    hint?: string; translation?: string
}
interface TranslateContent { description: string; inputFormat: string; outputFormat: string; hint: string }

const w = window as any

// 初始化洛谷插件设置变量 (matches original luogu.js top-level init)
w.luoguThemeEnabled = localStorage.getItem('phoi_luogu_theme_enabled') !== 'false'

function getLuoguThemeColors(): LuoguColors {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    if (isLight) {
        return {
            bg: '#ffffff', bgAlt: '#f5f5f5', bgHover: '#e8e8e8', bgCode: '#f0f0f0',
            text: '#333333', textSecondary: '#666666', textMuted: '#888888',
            border: '#e0e0e0', borderLight: '#d0d0d0',
            btnPrimary: '#0078d4', btnSecondary: '#e0e0e0', btnTranslate: '#2d8c4e', btnTranslateHover: '#257a40',
            btnDisabled: '#1e5a3a', btnError: '#8b5a2b', btnCph: '#5a3fc0',
            headingColor: '#0000ff',
            difficultyGray: '#999', difficultyRed: '#ff4444', difficultyOrange: '#ff8800', difficultyYellow: '#ffbb00',
            difficultyGreen: '#00aa00', difficultyBlue: '#0066cc', difficultyPurple: '#8800cc', difficultyDarkPurple: '#220066',
            loadingText: '#666', errorText: '#d13438', successText: '#2d8c4e', warnText: '#9d6b00',
        }
    }
    return {
        bg: '#1e1e1e', bgAlt: '#1a1a1a', bgHover: '#2a2a2a', bgCode: '#1e1e1e',
        text: '#d4d4d4', textSecondary: '#aaaaaa', textMuted: '#888888',
        border: '#333', borderLight: '#3c3c3c',
        btnPrimary: '#0e639c', btnSecondary: '#3e3e42', btnTranslate: '#2d8c4e', btnTranslateHover: '#1e5a3a',
        btnDisabled: '#1e5a3a', btnError: '#8b5a2b', btnCph: '#5a3fc0',
        headingColor: '#569cd6',
        difficultyGray: '#666', difficultyRed: '#ff4444', difficultyOrange: '#ff8800', difficultyYellow: '#ffbb00',
        difficultyGreen: '#00aa00', difficultyBlue: '#0066cc', difficultyPurple: '#8800cc', difficultyDarkPurple: '#220066',
        loadingText: '#ccc', errorText: '#f48771', successText: '#2d8c4e', warnText: '#cca700',
    }
}

export function initLuoguFeature(): void {
    w.luoguThemeEnabled = localStorage.getItem('phoi_luogu_theme_enabled') !== 'false'
    updateLuoguButtonVisibility()
    const checkbox = document.getElementById('luogu-theme-enabled') as HTMLInputElement | null
    if (checkbox) {
        checkbox.checked = w.luoguThemeEnabled
        checkbox.addEventListener('change', function (this: HTMLInputElement) {
            w.luoguThemeEnabled = this.checked
            localStorage.setItem('phoi_luogu_theme_enabled', String(this.checked))
            updateLuoguButtonVisibility()
            console.log('洛谷主题插件状态已更新:', this.checked)
        })
    }
}

function updateLuoguButtonVisibility(): void {
    let luoguContainer = document.getElementById('luogu-container') as HTMLElement | null
    if (!luoguContainer) {
        luoguContainer = document.createElement('div')
        luoguContainer.id = 'luogu-container'
        luoguContainer.style.display = 'flex'
        luoguContainer.style.alignItems = 'center'
        const menuBarRight = document.getElementById('menu-bar-right')
        const runBtn = document.getElementById('run-btn')
        if (menuBarRight && runBtn) {
            menuBarRight.insertBefore(luoguContainer, runBtn)
        }
    }
    luoguContainer.innerHTML = ''
    if (w.luoguThemeEnabled) {
        const luoguBtn = document.createElement('button')
        luoguBtn.id = 'luogu-btn'
        luoguBtn.className = 'tool-btn'
        luoguBtn.title = '洛谷题目'
        const luoguImg = document.createElement('img')
        luoguImg.src = '/static/Luogu.png'
        luoguImg.alt = 'Luogu'
        luoguImg.className = 'icon-btn'
        luoguBtn.appendChild(luoguImg)
        luoguContainer.appendChild(luoguBtn)
        luoguBtn.addEventListener('click', showLuoguProblemDialog)
    }
}

function showLuoguProblemDialog(): void {
    const colors = getLuoguThemeColors()
    const modal = document.createElement('div')
    modal.id = 'luogu-modal'
    modal.className = 'modal-overlay'
    modal.style.display = 'flex'
    modal.style.zIndex = '200'
    const modalContent = document.createElement('div')
    modalContent.className = 'modal-content'
    const isMobile = !w.isFullMode
    if (isMobile) {
        modalContent.style.width = '90%'
        modalContent.style.maxWidth = 'none'
        modalContent.style.margin = '20px'
        modalContent.style.maxHeight = '80vh'
    } else {
        modalContent.style.width = '80%'
        modalContent.style.maxWidth = '500px'
        modalContent.style.margin = 'auto'
    }
    const modalHeader = document.createElement('div')
    modalHeader.className = 'modal-header'
    const headerTitle = document.createElement('h2')
    headerTitle.textContent = '洛谷题目查询'
    const closeBtn = document.createElement('span')
    closeBtn.className = 'close-btn'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => { document.body.removeChild(modal) })
    modalHeader.appendChild(headerTitle)
    modalHeader.appendChild(closeBtn)
    const modalBody = document.createElement('div')
    modalBody.className = 'modal-body'
    modalBody.style.padding = '20px'
    if (isMobile) {
        modalBody.style.maxHeight = '60vh'
        modalBody.style.overflowY = 'auto'
    }
    if (typeof w._enableCustomTouchScroll === 'function') {
        w._enableCustomTouchScroll(modalBody)
        w._enableCustomTouchScroll(modalContent)
    }
    const inputLabel = document.createElement('label')
    inputLabel.textContent = '请输入题号（例如：P1001 或 p1001）：'
    inputLabel.style.display = 'block'
    inputLabel.style.marginBottom = '10px'
    inputLabel.style.color = colors.textSecondary
    const inputField = document.createElement('input')
    inputField.type = 'text'
    inputField.placeholder = '例如：P1001'
    inputField.style.width = '100%'
    inputField.style.padding = '12px'
    inputField.style.marginBottom = '15px'
    inputField.style.backgroundColor = colors.bg
    inputField.style.color = colors.text
    inputField.style.border = '1px solid ' + colors.borderLight
    inputField.style.borderRadius = '4px'
    inputField.style.fontSize = '16px'
    if (isMobile) { inputField.style.minHeight = '44px' }
    const savedProblemId = localStorage.getItem('phoi_last_luogu_problem_id')
    if (savedProblemId) { inputField.value = savedProblemId }
    const readMarkdownBtn = document.createElement('button')
    readMarkdownBtn.textContent = '从剪切板读取Markdown格式题目'
    readMarkdownBtn.className = 'modal-btn'
    readMarkdownBtn.style.backgroundColor = colors.btnSecondary
    readMarkdownBtn.style.marginRight = '10px'
    readMarkdownBtn.style.padding = '12px 24px'
    if (isMobile) { readMarkdownBtn.style.minHeight = '44px'; readMarkdownBtn.style.fontSize = '16px' }
    const openLastProblemBtn = document.createElement('button')
    openLastProblemBtn.textContent = '打开上次读取的题目'
    openLastProblemBtn.className = 'modal-btn'
    openLastProblemBtn.style.backgroundColor = colors.btnSecondary
    openLastProblemBtn.style.marginRight = '10px'
    openLastProblemBtn.style.padding = '12px 24px'
    if (isMobile) { openLastProblemBtn.style.minHeight = '44px'; openLastProblemBtn.style.fontSize = '16px' }
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = '查询'
    confirmBtn.className = 'modal-btn'
    confirmBtn.style.backgroundColor = colors.btnPrimary
    confirmBtn.style.float = 'right'
    confirmBtn.style.padding = '12px 24px'
    if (isMobile) { confirmBtn.style.minHeight = '44px'; confirmBtn.style.fontSize = '16px' }
    readMarkdownBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText()
            if (isValidMarkdownProblem(text)) {
                localStorage.setItem('phoi_last_markdown_problem', text)
                showMessage('Markdown题目已读取并保存', 'system')
                parseAndDisplayMarkdownProblem(text)
                document.body.removeChild(modal)
            } else {
                showMessage('剪贴板内容不是有效的Markdown格式题目', 'system')
            }
        } catch {
            showMessage('无法读取剪贴板，请确保使用HTTPS或本地环境', 'system')
        }
    })
    openLastProblemBtn.addEventListener('click', () => {
        const lastProblem = localStorage.getItem('phoi_last_markdown_problem')
        if (lastProblem) {
            parseAndDisplayMarkdownProblem(lastProblem)
            document.body.removeChild(modal)
            showMessage('已打开上次读取的题目', 'system')
        } else {
            showMessage('没有找到上次读取的题目', 'system')
        }
    })
    inputField.addEventListener('keyup', (e: KeyboardEvent) => {
        if (e.key === 'Enter') { confirmBtn.click() }
    })
    confirmBtn.addEventListener('click', () => {
        const problemId = inputField.value.trim()
        if (problemId) {
            const normalizedId = problemId.toUpperCase()
            localStorage.setItem('phoi_last_luogu_problem_id', problemId)
            loadLuoguProblem(normalizedId)
            document.body.removeChild(modal)
        }
    })
    modalBody.appendChild(inputLabel)
    modalBody.appendChild(inputField)
    modalBody.appendChild(readMarkdownBtn)
    modalBody.appendChild(openLastProblemBtn)
    modalBody.appendChild(confirmBtn)
    modalContent.appendChild(modalHeader)
    modalContent.appendChild(modalBody)
    modal.appendChild(modalContent)
    document.body.appendChild(modal)
    inputField.focus()
    if (isMobile) {
        setTimeout(() => { inputField.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 300)
    }
}

async function loadLuoguProblem(problemId: string): Promise<void> {
    const colors = getLuoguThemeColors()
    createProblemDisplayArea()
    const problemDisplay = document.getElementById('problem-display') as HTMLElement | null
    if (!problemDisplay) return
    const isMobile = !w.isFullMode
    problemDisplay.style.display = 'block'
    const existingCloseBtn = problemDisplay.querySelector('.problem-display-close') as HTMLElement | null
    const oldScrollContainer = problemDisplay.querySelector('[data-scroll-container]')
    if (oldScrollContainer) { oldScrollContainer.remove() }
    const loadingContainer = document.createElement('div')
    loadingContainer.setAttribute('data-scroll-container', 'true')
    loadingContainer.style.height = '100%'
    loadingContainer.style.overflowY = 'auto'
    loadingContainer.style.padding = '20px'
    loadingContainer.style.boxSizing = 'border-box'
    loadingContainer.style.textAlign = isMobile ? 'center' : 'left'
    loadingContainer.style.color = colors.textSecondary
    loadingContainer.textContent = '正在加载题目...'
    problemDisplay.appendChild(loadingContainer)
    if (existingCloseBtn) { problemDisplay.appendChild(existingCloseBtn) }
    if (!isMobile) {
        const resizer = document.getElementById('problem-display-resizer')
        if (resizer) {
            resizer.style.display = 'block'
            resizer.style.left = 'calc(100% - ' + problemDisplay.offsetWidth + 'px)'
        }
    }
    try {
        const problemData = await fetchLuoguProblemData(problemId)
        if (problemData) {
            displayLuoguProblem(problemData)
        } else {
            const errContainer = document.createElement('div')
            errContainer.setAttribute('data-scroll-container', 'true')
            errContainer.style.height = '100%'
            errContainer.style.overflowY = 'auto'
            errContainer.style.padding = '20px'
            errContainer.style.boxSizing = 'border-box'
            errContainer.style.textAlign = isMobile ? 'center' : 'left'
            errContainer.style.color = colors.errorText
            errContainer.textContent = '未找到题目：' + problemId
            const old = problemDisplay.querySelector('[data-scroll-container]')
            if (old) { old.remove() }
            problemDisplay.appendChild(errContainer)
            if (existingCloseBtn) { problemDisplay.appendChild(existingCloseBtn) }
        }
    } catch (error: any) {
        const errContainer = document.createElement('div')
        errContainer.setAttribute('data-scroll-container', 'true')
        errContainer.style.height = '100%'
        errContainer.style.overflowY = 'auto'
        errContainer.style.padding = '20px'
        errContainer.style.boxSizing = 'border-box'
        errContainer.style.textAlign = isMobile ? 'center' : 'left'
        errContainer.style.color = colors.errorText
        errContainer.textContent = '加载题目失败：' + error.message
        const old = problemDisplay.querySelector('[data-scroll-container]')
        if (old) { old.remove() }
        problemDisplay.appendChild(errContainer)
        if (existingCloseBtn) { problemDisplay.appendChild(existingCloseBtn) }
    }
}

async function fetchLuoguProblemData(problemId: string): Promise<ProblemData | null> {
    const normalized = problemId.toUpperCase()
    const match = normalized.match(/^([BP])(\d+)$/)
    if (!match) return null
    const type = match[1]
    const indexRes = await fetch('static/data/luogu_index.json')
    if (!indexRes.ok) return null
    const index = await indexRes.json()
    const chunks = index.types?.[type]
    if (!chunks || chunks.length === 0) return null
    let low = 0, high = chunks.length - 1
    let targetChunk: any = null
    while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const chunk = chunks[mid]
        const minNum = parseInt(chunk.min_pid.slice(1), 10)
        const maxNum = parseInt(chunk.max_pid.slice(1), 10)
        const targetNum = parseInt(match[2], 10)
        if (targetNum >= minNum && targetNum <= maxNum) {
            targetChunk = chunk
            break
        } else if (targetNum < minNum) {
            high = mid - 1
        } else {
            low = mid + 1
        }
    }
    if (!targetChunk) return null
    const fileRes = await fetch('static/data/' + targetChunk.file)
    if (!fileRes.ok) return null
    const text = await fileRes.text()
    const lines = text.split('\n').filter(line => line.trim())
    for (const line of lines) {
        try {
            const data = JSON.parse(line)
            if (data.pid && data.pid.toUpperCase() === normalized) {
                return data
            }
        } catch { }
    }
    return null
}

function createProblemDisplayArea(): HTMLElement | null {
    const colors = getLuoguThemeColors()
    let problemDisplay = document.getElementById('problem-display') as HTMLElement | null
    if (!problemDisplay) {
        problemDisplay = document.createElement('div')
        problemDisplay.id = 'problem-display'
        const isMobile = !w.isFullMode
        if (isMobile) {
            problemDisplay.style.position = 'fixed'
            problemDisplay.style.top = '36px'
            problemDisplay.style.left = '0'
            problemDisplay.style.right = '0'
            problemDisplay.style.bottom = '0'
            problemDisplay.style.width = 'auto'
            problemDisplay.style.height = 'auto'
            problemDisplay.style.backgroundColor = colors.bg
            problemDisplay.style.zIndex = '100'
            problemDisplay.style.overflowY = 'hidden'
            problemDisplay.style.touchAction = 'none'
            problemDisplay.style.display = 'none'
            problemDisplay.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)'
            const closeBtn = document.createElement('div')
            closeBtn.innerHTML = '×'
            closeBtn.className = 'problem-display-close'
            closeBtn.style.position = 'absolute'
            closeBtn.style.top = '10px'
            closeBtn.style.right = '10px'
            closeBtn.style.cursor = 'pointer'
            closeBtn.style.fontSize = '24px'
            closeBtn.style.color = colors.textSecondary
            closeBtn.style.zIndex = '101'
            closeBtn.addEventListener('click', () => { problemDisplay!.style.display = 'none' })
            problemDisplay.appendChild(closeBtn)
            document.body.appendChild(problemDisplay)
        } else {
            problemDisplay.style.position = 'fixed'
            problemDisplay.style.top = '36px'
            problemDisplay.style.right = '0'
            problemDisplay.style.width = '400px'
            problemDisplay.style.height = 'calc(100vh - 36px)'
            problemDisplay.style.backgroundColor = colors.bg
            problemDisplay.style.borderLeft = '1px solid ' + colors.border
            problemDisplay.style.zIndex = '100'
            problemDisplay.style.overflowY = 'hidden'
            problemDisplay.style.display = 'none'
            problemDisplay.style.boxShadow = '-5px 0 15px rgba(0,0,0,0.5)'
            const closeBtn = document.createElement('div')
            closeBtn.innerHTML = '×'
            closeBtn.className = 'problem-display-close'
            closeBtn.style.position = 'absolute'
            closeBtn.style.top = '10px'
            closeBtn.style.right = '10px'
            closeBtn.style.cursor = 'pointer'
            closeBtn.style.fontSize = '24px'
            closeBtn.style.color = colors.textSecondary
            closeBtn.style.zIndex = '101'
            closeBtn.addEventListener('click', () => {
                problemDisplay!.style.display = 'none'
                const resizer = document.getElementById('problem-display-resizer')
                if (resizer) { resizer.style.display = 'none' }
            })
            problemDisplay.appendChild(closeBtn)
            document.body.appendChild(problemDisplay)
            const resizer = document.createElement('div')
            resizer.id = 'problem-display-resizer'
            resizer.style.position = 'fixed'
            resizer.style.top = '36px'
            resizer.style.left = 'calc(100% - 400px)'
            resizer.style.width = '15px'
            resizer.style.height = 'calc(100vh - 36px)'
            resizer.style.cursor = 'ew-resize'
            resizer.style.zIndex = '101'
            resizer.style.backgroundColor = 'transparent'
            resizer.style.transition = 'background-color 0.2s'
            resizer.style.display = 'none'
            resizer.addEventListener('mouseenter', function () { this.style.backgroundColor = 'rgba(0, 122, 204, 0.3)' })
            resizer.addEventListener('mouseleave', function () { this.style.backgroundColor = 'transparent' })
            let isResizing = false
            let startX = 0, startWidth = 0
            resizer.addEventListener('mousedown', function (e) {
                isResizing = true
                startX = e.clientX
                startWidth = problemDisplay!.offsetWidth
                document.body.style.cursor = 'ew-resize'
                document.body.style.userSelect = 'none'
                e.preventDefault()
            })
            document.addEventListener('mousemove', function (e) {
                if (!isResizing) return
                const deltaX = startX - e.clientX
                const newWidth = startWidth + deltaX
                if (newWidth >= 200 && newWidth <= window.innerWidth - 200) {
                    problemDisplay!.style.width = newWidth + 'px'
                    resizer.style.left = 'calc(100% - ' + newWidth + 'px)'
                }
            })
            document.addEventListener('mouseup', function () {
                if (isResizing) {
                    isResizing = false
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                }
            })
            document.body.appendChild(resizer)
            window.addEventListener('resize', function () {
                const r = document.getElementById('problem-display-resizer')
                if (r && problemDisplay && problemDisplay.style.display !== 'none') {
                    r.style.left = 'calc(100% - ' + problemDisplay.offsetWidth + 'px)'
                }
            })
        }
    }
    return problemDisplay
}

function displayLuoguProblem(problemData: ProblemData): void {
    const colors = getLuoguThemeColors()
    const problemDisplay = document.getElementById('problem-display') as HTMLElement | null
    if (!problemDisplay) return
    const isMobile = !w.isFullMode
    const existingCloseBtn = problemDisplay.querySelector('.problem-display-close') as HTMLElement | null
    const oldScrollContainer = problemDisplay.querySelector('[data-scroll-container]')
    if (oldScrollContainer) { oldScrollContainer.remove() }
    problemDisplay.style.display = 'block'
    if (!isMobile) {
        const resizer = document.getElementById('problem-display-resizer')
        if (resizer) {
            resizer.style.display = 'block'
            resizer.style.left = 'calc(100% - ' + problemDisplay.offsetWidth + 'px)'
        }
    }
    const scrollContainer = document.createElement('div')
    scrollContainer.style.height = '100%'
    scrollContainer.style.overflowY = 'auto'
    scrollContainer.style.padding = '20px'
    scrollContainer.style.boxSizing = 'border-box'
    scrollContainer.style.touchAction = 'none'
    scrollContainer.setAttribute('data-scroll-container', 'true')
    if (typeof w._enableCustomTouchScroll === 'function') {
        w._enableCustomTouchScroll(scrollContainer)
    }
    problemDisplay.appendChild(scrollContainer)
    if (existingCloseBtn) { existingCloseBtn.remove() }
    const difficultyTag = document.createElement('div')
    difficultyTag.style.display = 'inline-block'
    difficultyTag.style.padding = '4px 8px'
    difficultyTag.style.borderRadius = '4px'
    difficultyTag.style.fontSize = '12px'
    difficultyTag.style.fontWeight = 'bold'
    difficultyTag.style.marginRight = '10px'
    difficultyTag.style.verticalAlign = 'middle'
    const diffLabels = ['暂无评定', '入门', '普及-', '普及/提高-', '普及+/提高', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTSC']
    const diffStyle = [
        { bg: colors.difficultyGray, fg: 'white' },
        { bg: colors.difficultyRed, fg: 'white' },
        { bg: colors.difficultyOrange, fg: 'white' },
        { bg: colors.difficultyYellow, fg: 'black' },
        { bg: colors.difficultyGreen, fg: 'white' },
        { bg: colors.difficultyBlue, fg: 'white' },
        { bg: colors.difficultyPurple, fg: 'white' },
        { bg: colors.difficultyDarkPurple, fg: 'white' },
    ]
    const diff = problemData.difficulty !== undefined ? problemData.difficulty : 0
    if (diff < diffLabels.length) {
        difficultyTag.style.backgroundColor = diffStyle[diff]?.bg || colors.difficultyGray
        difficultyTag.style.color = diffStyle[diff]?.fg || 'white'
        difficultyTag.textContent = diffLabels[diff] || '未知难度'
    } else {
        difficultyTag.style.backgroundColor = colors.difficultyGray
        difficultyTag.style.color = 'white'
        difficultyTag.textContent = '未知难度'
    }
    const titleContainer = document.createElement('div')
    titleContainer.style.display = 'flex'
    titleContainer.style.justifyContent = 'space-between'
    titleContainer.style.alignItems = 'center'
    titleContainer.style.marginTop = '30px'
    titleContainer.style.flexWrap = 'wrap'
    titleContainer.style.gap = '10px'
    const titleElement = document.createElement('h2')
    titleElement.style.color = colors.textSecondary
    titleElement.style.margin = '0'
    titleElement.style.flex = '1'
    titleElement.style.minWidth = '0'
    titleElement.style.display = 'flex'
    titleElement.style.alignItems = 'center'
    titleElement.appendChild(difficultyTag)
    const titleSpan = document.createElement('span')
    titleSpan.textContent = problemData.pid + '. ' + problemData.title
    titleElement.appendChild(titleSpan)
    const linkButton = document.createElement('a')
    linkButton.href = 'https://www.luogu.com.cn/problem/' + problemData.pid
    linkButton.target = '_blank'
    linkButton.style.backgroundColor = colors.btnPrimary
    linkButton.style.color = 'white'
    linkButton.style.padding = '8px 16px'
    linkButton.style.textDecoration = 'none'
    linkButton.style.borderRadius = '4px'
    linkButton.style.fontSize = '14px'
    linkButton.style.whiteSpace = 'nowrap'
    linkButton.textContent = '跳转到洛谷'
    const cphPluginEnabled = localStorage.getItem('cph_plugin_enabled') === 'true'
    const cphTransferButton = document.createElement('button')
    if (cphPluginEnabled) {
        cphTransferButton.textContent = '传送至CPH'
        cphTransferButton.style.backgroundColor = colors.btnCph
        cphTransferButton.style.color = 'white'
        cphTransferButton.style.padding = '8px 16px'
        cphTransferButton.style.textDecoration = 'none'
        cphTransferButton.style.border = 'none'
        cphTransferButton.style.borderRadius = '4px'
        cphTransferButton.style.fontSize = '14px'
        cphTransferButton.style.whiteSpace = 'nowrap'
        cphTransferButton.style.marginRight = '10px'
        cphTransferButton.style.cursor = 'pointer'
        cphTransferButton.addEventListener('click', function (e) {
            e.preventDefault()
            transferProblemToCPH(problemData)
        })
    } else {
        cphTransferButton.style.display = 'none'
    }
    const translateButton = document.createElement('button')
    translateButton.textContent = '翻译'
    translateButton.style.backgroundColor = colors.btnTranslate
    translateButton.style.color = 'white'
    translateButton.style.padding = '8px 16px'
    translateButton.style.textDecoration = 'none'
    translateButton.style.border = 'none'
    translateButton.style.borderRadius = '4px'
    translateButton.style.fontSize = '14px'
    translateButton.style.whiteSpace = 'nowrap'
    translateButton.style.marginRight = '10px'
    translateButton.style.cursor = 'pointer'
    let isTranslated = false
    const originalContent: TranslateContent = {
        description: problemData.description || '',
        inputFormat: problemData.inputFormat || '',
        outputFormat: problemData.outputFormat || '',
        hint: problemData.hint || ''
    }
    const translatedContent: TranslateContent = { description: '', inputFormat: '', outputFormat: '', hint: '' }
    translateButton.addEventListener('click', function (e) {
        e.preventDefault()
        if (isTranslated) {
            const renderOptions = {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            }
            const descElement = document.getElementById('problem-description')
            const ife = document.getElementById('problem-input-format')
            const ofe = document.getElementById('problem-output-format')
            const he = document.getElementById('problem-hint')
            if (descElement) { descElement.innerHTML = (w.marked as any).parse(originalContent.description); (w.renderMathInElement as any)(descElement, renderOptions) }
            if (ife) { ife.innerHTML = (w.marked as any).parse(originalContent.inputFormat); (w.renderMathInElement as any)(ife, renderOptions) }
            if (ofe) { ofe.innerHTML = (w.marked as any).parse(originalContent.outputFormat); (w.renderMathInElement as any)(ofe, renderOptions) }
            if (he) { he.innerHTML = (w.marked as any).parse(originalContent.hint); (w.renderMathInElement as any)(he, renderOptions) }
            translateButton.textContent = '翻译'
            translateButton.style.backgroundColor = colors.btnTranslate
            isTranslated = false
            showMessage('已返回原文', 'success')
        } else {
            translateProblemContent(problemData, translateButton, originalContent, translatedContent, function () { isTranslated = true })
        }
    })
    titleContainer.appendChild(titleElement)
    titleContainer.appendChild(translateButton)
    titleContainer.appendChild(cphTransferButton)
    titleContainer.appendChild(linkButton)
    scrollContainer.appendChild(titleContainer)
    const descSection = document.createElement('div')
    descSection.style.margin = '20px 0'
    const descHeading = document.createElement('h3')
    descHeading.style.color = colors.headingColor
    descHeading.textContent = '题目描述'
    const descContent = document.createElement('div')
    descContent.id = 'problem-description'
    descContent.style.color = colors.text
    descContent.style.lineHeight = '1.6'
    descSection.appendChild(descHeading)
    descSection.appendChild(descContent)
    scrollContainer.appendChild(descSection)
    const inputSection = document.createElement('div')
    inputSection.style.margin = '20px 0'
    const inputHeading = document.createElement('h3')
    inputHeading.style.color = colors.headingColor
    inputHeading.textContent = '输入格式'
    const inputContent = document.createElement('div')
    inputContent.id = 'problem-input-format'
    inputContent.style.color = colors.text
    inputContent.style.lineHeight = '1.6'
    inputSection.appendChild(inputHeading)
    inputSection.appendChild(inputContent)
    scrollContainer.appendChild(inputSection)
    const outputSection = document.createElement('div')
    outputSection.style.margin = '20px 0'
    const outputHeading = document.createElement('h3')
    outputHeading.style.color = colors.headingColor
    outputHeading.textContent = '输出格式'
    const outputContent = document.createElement('div')
    outputContent.id = 'problem-output-format'
    outputContent.style.color = colors.text
    outputContent.style.lineHeight = '1.6'
    outputSection.appendChild(outputHeading)
    outputSection.appendChild(outputContent)
    scrollContainer.appendChild(outputSection)
    if (problemData.samples && Array.isArray(problemData.samples) && problemData.samples.length > 0) {
        const samplesSection = document.createElement('div')
        samplesSection.style.margin = '20px 0'
        const samplesHeading = document.createElement('h3')
        samplesHeading.style.color = colors.headingColor
        samplesHeading.textContent = '样例'
        samplesSection.appendChild(samplesHeading)
        problemData.samples.forEach((sample, index) => {
            const sampleContainer = document.createElement('div')
            sampleContainer.style.margin = '15px 0'
            sampleContainer.style.border = '1px solid ' + colors.border
            sampleContainer.style.borderRadius = '4px'
            sampleContainer.style.overflow = 'hidden'
            const inputBlock = document.createElement('div')
            inputBlock.style.padding = '10px'
            inputBlock.style.backgroundColor = colors.bgAlt
            const inputLabel = document.createElement('div')
            inputLabel.style.color = colors.warnText
            inputLabel.style.fontWeight = 'bold'
            inputLabel.style.marginBottom = '5px'
            inputLabel.textContent = '输入 #' + (index + 1)
            const inputPre = document.createElement('pre')
            inputPre.style.background = colors.bg
            inputPre.style.padding = '10px'
            inputPre.style.border = '1px solid ' + colors.border
            inputPre.style.color = colors.text
            inputPre.style.whiteSpace = 'pre-wrap'
            inputPre.style.margin = '0'
            inputPre.style.overflowX = 'auto'
            ;(inputPre.style as any).webkitOverflowScrolling = 'touch'
            inputPre.textContent = sample[0] || ''
            inputBlock.appendChild(inputLabel)
            inputBlock.appendChild(inputPre)
            const outputBlock = document.createElement('div')
            outputBlock.style.padding = '10px'
            outputBlock.style.backgroundColor = colors.bgAlt
            const outputLabel = document.createElement('div')
            outputLabel.style.color = colors.warnText
            outputLabel.style.fontWeight = 'bold'
            outputLabel.style.marginBottom = '5px'
            outputLabel.textContent = '输出 #' + (index + 1)
            const outputPre = document.createElement('pre')
            outputPre.style.background = colors.bg
            outputPre.style.padding = '10px'
            outputPre.style.border = '1px solid ' + colors.border
            outputPre.style.color = colors.text
            outputPre.style.whiteSpace = 'pre-wrap'
            outputPre.style.margin = '0'
            outputPre.style.overflowX = 'auto'
            ;(outputPre.style as any).webkitOverflowScrolling = 'touch'
            outputPre.textContent = sample[1] || ''
            outputBlock.appendChild(outputLabel)
            outputBlock.appendChild(outputPre)
            sampleContainer.appendChild(inputBlock)
            sampleContainer.appendChild(outputBlock)
            samplesSection.appendChild(sampleContainer)
        })
        scrollContainer.appendChild(samplesSection)
    }
    if (problemData.hint) {
        const hintSection = document.createElement('div')
        hintSection.style.margin = '20px 0'
        const hintHeading = document.createElement('h3')
        hintHeading.style.color = colors.headingColor
        hintHeading.textContent = '提示'
        const hintContent = document.createElement('div')
        hintContent.id = 'problem-hint'
        hintContent.style.color = colors.text
        hintContent.style.lineHeight = '1.6'
        hintSection.appendChild(hintHeading)
        hintSection.appendChild(hintContent)
        scrollContainer.appendChild(hintSection)
    }
    renderMarkdownAndLatex('problem-description', problemData.description || '')
    renderMarkdownAndLatex('problem-input-format', problemData.inputFormat || '')
    renderMarkdownAndLatex('problem-output-format', problemData.outputFormat || '')
    if (problemData.hint) { renderMarkdownAndLatex('problem-hint', problemData.hint) }
    if (isMobile) {
        const editorArea = document.getElementById('editor-area')
        if (editorArea) { editorArea.style.display = 'none' }
        const backButton = document.createElement('div')
        backButton.innerHTML = '返回编辑器'
        backButton.style.position = 'fixed'
        backButton.style.bottom = '20px'
        backButton.style.left = '50%'
        backButton.style.transform = 'translateX(-50%)'
        backButton.style.backgroundColor = colors.btnPrimary
        backButton.style.color = 'white'
        backButton.style.padding = '12px 24px'
        backButton.style.borderRadius = '30px'
        backButton.style.cursor = 'pointer'
        backButton.style.zIndex = '102'
        backButton.style.textAlign = 'center'
        backButton.style.fontSize = '16px'
        backButton.style.fontWeight = 'bold'
        backButton.style.boxSizing = 'border-box'
        backButton.id = 'back-to-editor-btn'
        backButton.addEventListener('click', function () {
            problemDisplay!.style.display = 'none'
            const ea = document.getElementById('editor-area')
            if (ea) { ea.style.display = 'flex' }
            document.body.style.overflow = ''
        })
        problemDisplay.appendChild(backButton)
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
    }
    const closeBtn = document.createElement('div')
    closeBtn.innerHTML = '×'
    closeBtn.style.position = 'absolute'
    closeBtn.style.top = '10px'
    closeBtn.style.right = '10px'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.fontSize = '24px'
    closeBtn.style.color = colors.textSecondary
    closeBtn.style.zIndex = '101'
    closeBtn.addEventListener('click', function () {
        problemDisplay!.style.display = 'none'
        if (isMobile) {
            const ea = document.getElementById('editor-area')
            if (ea) { ea.style.display = 'flex' }
            const lc = document.getElementById('lines-container')
            if (lc && lc.style.display !== 'none') {
                lc.style.display = 'flex'
                const ec = document.getElementById('editor-container')
                if (ec) { ec.style.display = 'none' }
            }
            const bb = document.getElementById('back-to-editor-btn')
            if (bb && bb.parentNode === problemDisplay) { bb.parentNode.removeChild(bb) }
            document.body.style.overflow = ''
        } else {
            document.body.style.overflow = ''
        }
    })
    problemDisplay.appendChild(closeBtn)
    if (isMobile) {
        const upBtn = document.createElement('div')
        upBtn.innerHTML = '↑'
        upBtn.className = 'up-btn-mobile'
        let upBtnInterval: number | undefined
        upBtn.addEventListener('mousedown', function () {
            scrollContainer.scrollTop -= 50
            upBtnInterval = window.setInterval(() => { scrollContainer.scrollTop -= 50 }, 100)
        })
        upBtn.addEventListener('touchstart', function (e) {
            e.preventDefault()
            scrollContainer.scrollTop -= 50
            upBtnInterval = window.setInterval(() => { scrollContainer.scrollTop -= 50 }, 100)
        })
        upBtn.addEventListener('mouseup', function () { clearInterval(upBtnInterval) })
        upBtn.addEventListener('touchend', function () { clearInterval(upBtnInterval) })
        upBtn.addEventListener('mouseleave', function () { clearInterval(upBtnInterval) })
        problemDisplay.appendChild(upBtn)
        const downBtn = document.createElement('div')
        downBtn.innerHTML = '↓'
        downBtn.className = 'down-btn-mobile'
        let downBtnInterval: number | undefined
        downBtn.addEventListener('mousedown', function () {
            scrollContainer.scrollTop += 50
            downBtnInterval = window.setInterval(() => { scrollContainer.scrollTop += 50 }, 100)
        })
        downBtn.addEventListener('touchstart', function (e) {
            e.preventDefault()
            scrollContainer.scrollTop += 50
            downBtnInterval = window.setInterval(() => { scrollContainer.scrollTop += 50 }, 100)
        })
        downBtn.addEventListener('mouseup', function () { clearInterval(downBtnInterval) })
        downBtn.addEventListener('touchend', function () { clearInterval(downBtnInterval) })
        downBtn.addEventListener('mouseleave', function () { clearInterval(downBtnInterval) })
        problemDisplay.appendChild(downBtn)
    }
}

function renderMarkdownAndLatex(elementId: string, content: string): void {
    const element = document.getElementById(elementId)
    if (!element) return
    const markdownContent = (w.marked as any).parse(content)
    element.innerHTML = markdownContent
    ;(w.renderMathInElement as any)(element, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
    })
}

async function transferProblemToCPH(problemData: ProblemData): Promise<void> {
    try {
        const problemId = problemData.pid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        const testCases: { stdin: string; stdout: string; name: string }[] = []
        if (problemData.samples && Array.isArray(problemData.samples) && problemData.samples.length > 0) {
            problemData.samples.forEach((sample, index) => {
                testCases.push({ stdin: sample[0], stdout: sample[1], name: '样例 ' + (index + 1) })
            })
        }
        const fileName = problemId + '.cpp'
        await createAndOpenCppFile(fileName)
        if (w.cphPlugin) {
            if (w.cphPlugin.currentFile !== fileName) {
                if (w.cphPlugin.testCases) { w.cphPlugin.saveTestCases() }
                w.cphPlugin.currentFile = fileName
                w.cphPlugin.testCases = w.cphPlugin.loadTestCases()
                localStorage.setItem('phoi_currentFileName', fileName)
            }
            testCases.forEach(tc => {
                const exists = w.cphPlugin.testCases.some((ec: any) => ec.stdin === tc.stdin && ec.stdout === tc.stdout)
                if (!exists) { w.cphPlugin.testCases.push(tc) }
            })
            w.cphPlugin.saveTestCases()
            w.cphPlugin.renderTestCases()
            w.cphPlugin.renderTestCasesMain()
            showMessage('成功传输 ' + testCases.length + ' 个测试用例到CPH: ' + fileName, 'success')
        } else {
            throw new Error('CPH插件未初始化')
        }
    } catch (error: any) {
        showMessage('传输题目到CPH失败: ' + error.message, 'error')
    }
}

async function createAndOpenCppFile(fileName: string): Promise<void> {
    if (!w.PhoiAPI) {
        showMessage('PhoiAPI 未初始化，无法创建文件', 'error')
        return
    }
    try {
        const fileList = await w.PhoiAPI.getFileList()
        const lower = fileName.toLowerCase()
        const existingFile = fileList.find((f: string) => f.toLowerCase() === lower)
        if (existingFile) {
            await w.PhoiAPI.openFile(fileName)
        } else {
            const result = await w.PhoiAPI.createNewFile(fileName)
            if (!result) { throw new Error('PhoiAPI.createNewFile 返回失败') }
        }
    } catch (err: any) {
        showMessage('创建文件失败: ' + err.message, 'error')
    }
}

function isValidMarkdownProblem(text: string): boolean {
    const lines = text.split('\n')
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (lines[i].trim().startsWith('#')) {
            if (text.includes('题目描述') || text.includes('输入格式') || text.includes('输出格式')) { return true }
        }
    }
    return false
}

function parseAndDisplayMarkdownProblem(markdownText: string): void {
    const pidMatch = markdownText.match(/^#\s*[^\n]*?([PBUT]\d+)/im)
    const pid = pidMatch ? pidMatch[1].toUpperCase() : 'MD'
    const titleMatch = markdownText.match(/^#\s*(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : '未命名题目'
    const samples = parseSamplesFromContent(markdownText)
    const mockProblemData: ProblemData = {
        pid: pid,
        title: title,
        difficulty: 0,
        description: markdownText,
        samples: samples
    }
    createProblemDisplayArea()
    displayMarkdownProblem(mockProblemData)
}

function separateMarkdownSections(markdownText: string): { description?: string; inputFormat?: string; outputFormat?: string; samples?: SampleTuple[]; hint?: string } {
    const sectionsByTitle: Record<string, string> = {}
    const lines = markdownText.split('\n')
    let currentTitle = ''
    let currentContent: string[] = []
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim().startsWith('#')) {
            if (currentTitle) { sectionsByTitle[currentTitle] = currentContent.join('\n') }
            currentTitle = line.trim()
            currentContent = []
        } else {
            currentContent.push(line)
        }
    }
    if (currentTitle) { sectionsByTitle[currentTitle] = currentContent.join('\n') }
    const sections: { description?: string; inputFormat?: string; outputFormat?: string; samples?: SampleTuple[]; hint?: string } = {}
    for (const title in sectionsByTitle) {
        const content = sectionsByTitle[title]
        if (title.includes('题目描述') || title.includes('题目叙述')) { sections.description = content }
        else if (title.includes('输入格式') || title.includes('输入说明')) { sections.inputFormat = content }
        else if (title.includes('输出格式') || title.includes('输出说明')) { sections.outputFormat = content }
        else if (title.includes('输入输出样例') || title.includes('样例') || title.includes('Sample')) {
            let samples = parseSamplesFromSection(content)
            if (samples.length === 0) { samples = parseSamplesFromContent(markdownText) }
            if (samples.length > 0) { sections.samples = samples }
        }
        else if (title.includes('提示') || title.includes('Hint') || title.includes('说明')) { sections.hint = content }
    }
    return sections
}

function parseSamplesFromContent(markdownText: string): SampleTuple[] {
    const samples: SampleTuple[] = []
    const sampleRegex = /###\s*输入\s*#(\d+)[\s\S]*?```(?:\w+)?\s*\n([\s\S]*?)\s*```[\s\S]*?###\s*输出\s*#(\d+)[\s\S]*?```(?:\w+)?\s*\n([\s\S]*?)\s*```/g
    let match: RegExpExecArray | null
    while ((match = sampleRegex.exec(markdownText)) !== null) {
        const input = match[2].trim()
        const output = match[4].trim()
        if (input && output) { samples.push([input, output]) }
    }
    if (samples.length === 0) {
        const altRegex = /##\s*输入输出样例[\s\S]*?###\s*输入\s*#(\d+)[\s\S]*?```(?:\w+)?\s*\n([\s\S]*?)\s*```[\s\S]*?###\s*输出\s*#(\d+)[\s\S]*?```(?:\w+)?\s*\n([\s\S]*?)\s*```/g
        while ((match = altRegex.exec(markdownText)) !== null) {
            const input = match[2].trim()
            const output = match[4].trim()
            if (input && output) { samples.push([input, output]) }
        }
    }
    if (samples.length === 0) {
        const looseRegex = /(##|#)?\s*#*\s*输入[\s\S]*?```(?:\w+)?\s*\n([\s\S]*?)\s*```[\s\S]*?(##|#)?\s*#*\s*输出[\s\S]*?```(?:\w+)?\s*\n([\s\S]*?)\s*```/g
        while ((match = looseRegex.exec(markdownText)) !== null) {
            const input = match[2].trim()
            const output = match[4].trim()
            if (input && output) { samples.push([input, output]) }
        }
    }
    return samples
}

function parseSamplesFromSection(sectionContent: string): SampleTuple[] {
    const samples: SampleTuple[] = []
    const lines = sectionContent.split('\n')
    let currentInput = ''
    let currentOutput = ''
    let inInputSection = false
    let inOutputSection = false
    let insideCodeBlock = false
    let currentCodeBlock = ''
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if ((line.trim().startsWith('### ') || line.trim().startsWith('## ')) && (line.includes('输入') || line.includes('输出'))) {
            if ((inInputSection || inOutputSection) && currentInput && currentOutput) {
                samples.push([currentInput.trim(), currentOutput.trim()])
                currentInput = ''
                currentOutput = ''
            }
            if (line.includes('输入')) { inInputSection = true; inOutputSection = false; currentInput = '' }
            else if (line.includes('输出')) { inOutputSection = true; inInputSection = false; currentOutput = '' }
        } else if (line.trim() === '```') {
            if (insideCodeBlock) {
                if (inInputSection) { currentInput += currentCodeBlock }
                else if (inOutputSection) { currentOutput += currentCodeBlock }
                currentCodeBlock = ''
                insideCodeBlock = false
            } else {
                insideCodeBlock = true
                currentCodeBlock = ''
            }
        } else if (insideCodeBlock) {
            currentCodeBlock += line + '\n'
        }
    }
    if (currentInput && currentOutput) { samples.push([currentInput.trim(), currentOutput.trim()]) }
    return samples
}

function parseSampleFromCodeBlock(codeBlock: string): SampleTuple[] {
    const samples: SampleTuple[] = []
    const codeBlocks = codeBlock.split('```')
    for (let i = 1; i < codeBlocks.length; i += 2) {
        const blockContent = codeBlocks[i].trim()
        const prevBlock = codeBlocks[i - 1] || ''
        const nextBlock = codeBlocks[i + 1] || ''
        const hasInputBefore = /(#?\s*输入[^\n]*|Input[^\n]*)/i.test(prevBlock)
        const hasOutputAfter = /(#?\s*输出[^\n]*|Output[^\n]*)/i.test(nextBlock)
        if (hasInputBefore && hasOutputAfter) {
            if (i + 2 < codeBlocks.length) { samples.push([blockContent, codeBlocks[i + 2].trim()]) }
        } else if (hasInputBefore) {
            if (i + 2 < codeBlocks.length) { samples.push([blockContent, codeBlocks[i + 2].trim()]) }
        } else {
            const splitByInOut = prevBlock.split(/(#?\s*输入[^\n]*|##?\s*输出[^\n]*|Input[^\n]*|Output[^\n]*)/gi)
            let currentInput = ''
            let currentOutput = ''
            for (let j = 0; j < splitByInOut.length; j++) {
                const segment = splitByInOut[j]
                if (/输入|Input/i.test(segment)) {
                    if (j + 1 < splitByInOut.length) currentInput = splitByInOut[j + 1].trim()
                } else if (/输出|Output/i.test(segment)) {
                    if (j + 1 < splitByInOut.length) currentOutput = splitByInOut[j + 1].trim()
                    if (currentInput && currentOutput) { samples.push([currentInput, currentOutput]); currentInput = ''; currentOutput = '' }
                }
            }
        }
    }
    if (samples.length === 0) {
        const lines = codeBlock.split('\n')
        let currentInput = ''
        let currentOutput = ''
        let inInputSection = false
        let inOutputSection = false
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (/输入\s*#[^0-9]*(\d+)/i.test(line) || /Input/i.test(line)) {
                if (currentInput && currentOutput) { samples.push([currentInput.trim(), currentOutput.trim()]) }
                inInputSection = true; inOutputSection = false; currentInput = ''
            } else if (/输出\s*#[^0-9]*(\d+)/i.test(line) || /Output/i.test(line)) {
                inInputSection = false; inOutputSection = true; currentOutput = ''
            } else if (line.startsWith('```') && line.endsWith('```')) {
                const codeContent = line.substring(3, line.length - 3)
                if (inInputSection) currentInput += codeContent + '\n'
                else if (inOutputSection) currentOutput += codeContent + '\n'
            } else if (inInputSection) { currentInput += line + '\n' }
            else if (inOutputSection) { currentOutput += line + '\n' }
        }
        if (currentInput && currentOutput) { samples.push([currentInput.trim(), currentOutput.trim()]) }
    }
    return samples
}

function displayMarkdownProblem(problemData: ProblemData): void {
    const colors = getLuoguThemeColors()
    const problemDisplay = document.getElementById('problem-display') as HTMLElement | null
    if (!problemDisplay) return
    const isMobile = !w.isFullMode
    problemDisplay.innerHTML = ''
    problemDisplay.style.display = 'block'
    const scrollContainer = document.createElement('div')
    scrollContainer.style.height = '100%'
    scrollContainer.style.overflowY = 'auto'
    scrollContainer.style.padding = '20px'
    scrollContainer.style.boxSizing = 'border-box'
    scrollContainer.style.touchAction = 'none'
    if (typeof w._enableCustomTouchScroll === 'function') { w._enableCustomTouchScroll(scrollContainer) }
    if (isMobile) {
        ;(scrollContainer.style as any).msOverflowStyle = 'none'
        scrollContainer.style.scrollbarWidth = 'none'
        const style = document.createElement('style')
        style.textContent = '#problem-display [data-scroll-container]::-webkit-scrollbar { display: none; }'
        document.head.appendChild(style)
    }
    scrollContainer.setAttribute('data-scroll-container', 'true')
    const titleContainer = document.createElement('div')
    titleContainer.style.display = 'flex'
    titleContainer.style.justifyContent = 'space-between'
    titleContainer.style.alignItems = 'center'
    titleContainer.style.marginTop = '30px'
    titleContainer.style.flexWrap = 'wrap'
    titleContainer.style.gap = '10px'
    const titleElement = document.createElement('h2')
    titleElement.style.color = colors.textSecondary
    titleElement.style.margin = '0'
    titleElement.style.flex = '1'
    titleElement.style.minWidth = '0'
    titleElement.style.display = 'flex'
    titleElement.style.alignItems = 'center'
    const titleSpan = document.createElement('span')
    titleSpan.textContent = problemData.pid + '. ' + problemData.title
    titleElement.appendChild(titleSpan)
    const cphPluginEnabled = localStorage.getItem('cph_plugin_enabled') === 'true'
    const cphTransferButton = document.createElement('button')
    if (cphPluginEnabled) {
        cphTransferButton.textContent = '传送至CPH'
        cphTransferButton.style.backgroundColor = colors.btnCph
        cphTransferButton.style.color = 'white'
        cphTransferButton.style.padding = '8px 16px'
        cphTransferButton.style.textDecoration = 'none'
        cphTransferButton.style.border = 'none'
        cphTransferButton.style.borderRadius = '4px'
        cphTransferButton.style.fontSize = '14px'
        cphTransferButton.style.whiteSpace = 'nowrap'
        cphTransferButton.style.marginRight = '10px'
        cphTransferButton.style.cursor = 'pointer'
        cphTransferButton.addEventListener('click', function (e) { e.preventDefault(); transferMarkdownProblemToCPH(problemData) })
    } else {
        cphTransferButton.style.display = 'none'
    }
    const translateButton = document.createElement('button')
    translateButton.textContent = '翻译'
    translateButton.style.backgroundColor = colors.btnTranslate
    translateButton.style.color = 'white'
    translateButton.style.padding = '8px 16px'
    translateButton.style.textDecoration = 'none'
    translateButton.style.border = 'none'
    translateButton.style.borderRadius = '4px'
    translateButton.style.fontSize = '14px'
    translateButton.style.whiteSpace = 'nowrap'
    translateButton.style.marginRight = '10px'
    translateButton.style.cursor = 'pointer'
    let isTranslated = false
    const originalContent: TranslateContent = {
        description: problemData.description || '',
        inputFormat: problemData.inputFormat || '',
        outputFormat: problemData.outputFormat || '',
        hint: problemData.hint || ''
    }
    const translatedContent: TranslateContent = { description: '', inputFormat: '', outputFormat: '', hint: '' }
    translateButton.addEventListener('click', function (e) {
        e.preventDefault()
        if (isTranslated) {
            const renderOptions = {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            }
            const fce = document.getElementById('full-markdown-content')
            if (fce) { fce.innerHTML = (w.marked as any).parse(originalContent.description); (w.renderMathInElement as any)(fce, renderOptions) }
            translateButton.textContent = '翻译'
            translateButton.style.backgroundColor = colors.btnTranslate
            isTranslated = false
            showMessage('已返回原文', 'success')
        } else {
            translateProblemContent(problemData, translateButton, originalContent, translatedContent, function () { isTranslated = true })
        }
    })
    titleContainer.appendChild(titleElement)
    titleContainer.appendChild(translateButton)
    titleContainer.appendChild(cphTransferButton)
    scrollContainer.appendChild(titleContainer)
    const fullContentSection = document.createElement('div')
    fullContentSection.style.margin = '20px 0'
    fullContentSection.style.color = colors.text
    fullContentSection.style.lineHeight = '1.6'
    const fullContentDiv = document.createElement('div')
    fullContentDiv.id = 'full-markdown-content'
    fullContentDiv.style.color = colors.text
    fullContentDiv.style.lineHeight = '1.6'
    fullContentSection.appendChild(fullContentDiv)
    scrollContainer.appendChild(fullContentSection)
    if (problemData.samples && Array.isArray(problemData.samples) && problemData.samples.length > 0) {
        const samplesSection = document.createElement('div')
        samplesSection.style.margin = '20px 0'
        const samplesHeading = document.createElement('h3')
        samplesHeading.style.color = colors.headingColor
        samplesHeading.textContent = '样例'
        samplesSection.appendChild(samplesHeading)
        problemData.samples.forEach((sample, index) => {
            const sampleContainer = document.createElement('div')
            sampleContainer.style.margin = '15px 0'
            sampleContainer.style.border = '1px solid ' + colors.border
            sampleContainer.style.borderRadius = '4px'
            sampleContainer.style.overflow = 'hidden'
            const inputBlock = document.createElement('div')
            inputBlock.style.padding = '10px'
            inputBlock.style.backgroundColor = colors.bgAlt
            const inputLabel = document.createElement('div')
            inputLabel.style.color = colors.warnText
            inputLabel.style.fontWeight = 'bold'
            inputLabel.style.marginBottom = '5px'
            inputLabel.textContent = '输入 #' + (index + 1)
            const inputPre = document.createElement('pre')
            inputPre.style.background = colors.bg
            inputPre.style.padding = '10px'
            inputPre.style.border = '1px solid ' + colors.border
            inputPre.style.color = colors.text
            inputPre.style.whiteSpace = 'pre-wrap'
            inputPre.style.margin = '0'
            inputPre.style.overflowX = 'auto'
            ;(inputPre.style as any).webkitOverflowScrolling = 'touch'
            inputPre.textContent = sample[0] || ''
            inputBlock.appendChild(inputLabel)
            inputBlock.appendChild(inputPre)
            const outputBlock = document.createElement('div')
            outputBlock.style.padding = '10px'
            outputBlock.style.backgroundColor = colors.bgAlt
            const outputLabel = document.createElement('div')
            outputLabel.style.color = colors.warnText
            outputLabel.style.fontWeight = 'bold'
            outputLabel.style.marginBottom = '5px'
            outputLabel.textContent = '输出 #' + (index + 1)
            const outputPre = document.createElement('pre')
            outputPre.style.background = colors.bg
            outputPre.style.padding = '10px'
            outputPre.style.border = '1px solid ' + colors.border
            outputPre.style.color = colors.text
            outputPre.style.whiteSpace = 'pre-wrap'
            outputPre.style.margin = '0'
            outputPre.style.overflowX = 'auto'
            ;(outputPre.style as any).webkitOverflowScrolling = 'touch'
            outputPre.textContent = sample[1] || ''
            outputBlock.appendChild(outputLabel)
            outputBlock.appendChild(outputPre)
            sampleContainer.appendChild(inputBlock)
            sampleContainer.appendChild(outputBlock)
            samplesSection.appendChild(sampleContainer)
        })
        scrollContainer.appendChild(samplesSection)
    }
    problemDisplay.appendChild(scrollContainer)
    if (isMobile) {
        const editorArea = document.getElementById('editor-area')
        if (editorArea) { editorArea.style.display = 'none' }
        const backButton = document.createElement('div')
        backButton.innerHTML = '返回编辑器'
        backButton.style.position = 'fixed'
        backButton.style.bottom = '20px'
        backButton.style.left = '50%'
        backButton.style.transform = 'translateX(-50%)'
        backButton.style.backgroundColor = colors.btnPrimary
        backButton.style.color = 'white'
        backButton.style.padding = '12px 24px'
        backButton.style.borderRadius = '30px'
        backButton.style.cursor = 'pointer'
        backButton.style.zIndex = '102'
        backButton.style.textAlign = 'center'
        backButton.style.fontSize = '16px'
        backButton.style.fontWeight = 'bold'
        backButton.style.boxSizing = 'border-box'
        backButton.id = 'back-to-editor-btn'
        backButton.addEventListener('click', function () {
            problemDisplay!.style.display = 'none'
            const ea = document.getElementById('editor-area')
            if (ea) { ea.style.display = 'flex' }
            document.body.style.overflow = ''
        })
        problemDisplay.appendChild(backButton)
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
    }
    renderMarkdownAndLatex('full-markdown-content', problemData.description || '')
    const closeBtn = document.createElement('div')
    closeBtn.innerHTML = '×'
    closeBtn.style.position = 'absolute'
    closeBtn.style.top = '10px'
    closeBtn.style.right = '10px'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.fontSize = '24px'
    closeBtn.style.color = colors.textSecondary
    closeBtn.style.zIndex = '101'
    closeBtn.addEventListener('click', function () {
        problemDisplay!.style.display = 'none'
        if (isMobile) {
            const ea = document.getElementById('editor-area')
            if (ea) { ea.style.display = 'flex' }
            const lc = document.getElementById('lines-container')
            if (lc && lc.style.display !== 'none') {
                lc.style.display = 'flex'
                const ec = document.getElementById('editor-container')
                if (ec) { ec.style.display = 'none' }
            }
            const bb = document.getElementById('back-to-editor-btn')
            if (bb && bb.parentNode === problemDisplay) { bb.parentNode.removeChild(bb) }
            document.body.style.overflow = ''
        } else {
            document.body.style.overflow = ''
        }
    })
    problemDisplay.appendChild(closeBtn)
    if (isMobile) {
        const upBtn = document.createElement('div')
        upBtn.innerHTML = '↑'
        upBtn.className = 'up-btn-mobile'
        let upBtnInterval: number | undefined
        upBtn.addEventListener('mousedown', function () {
            scrollContainer.scrollTop -= 50
            upBtnInterval = window.setInterval(() => { scrollContainer.scrollTop -= 50 }, 100)
        })
        upBtn.addEventListener('touchstart', function (e) { e.preventDefault(); scrollContainer.scrollTop -= 50; upBtnInterval = window.setInterval(() => { scrollContainer.scrollTop -= 50 }, 100) })
        upBtn.addEventListener('mouseup', function () { clearInterval(upBtnInterval) })
        upBtn.addEventListener('touchend', function () { clearInterval(upBtnInterval) })
        upBtn.addEventListener('mouseleave', function () { clearInterval(upBtnInterval) })
        problemDisplay.appendChild(upBtn)
        const downBtn = document.createElement('div')
        downBtn.innerHTML = '↓'
        downBtn.className = 'down-btn-mobile'
        let downBtnInterval: number | undefined
        downBtn.addEventListener('mousedown', function () {
            scrollContainer.scrollTop += 50
            downBtnInterval = window.setInterval(() => { scrollContainer.scrollTop += 50 }, 100)
        })
        downBtn.addEventListener('touchstart', function (e) { e.preventDefault(); scrollContainer.scrollTop += 50; downBtnInterval = window.setInterval(() => { scrollContainer.scrollTop += 50 }, 100) })
        downBtn.addEventListener('mouseup', function () { clearInterval(downBtnInterval) })
        downBtn.addEventListener('touchend', function () { clearInterval(downBtnInterval) })
        downBtn.addEventListener('mouseleave', function () { clearInterval(downBtnInterval) })
        problemDisplay.appendChild(downBtn)
    }
}

async function transferMarkdownProblemToCPH(problemData: ProblemData): Promise<void> {
    try {
        let problemId = problemData.pid
        if (!problemId || problemId === 'MD') {
            const pidMatch = problemData.title.match(/^[PBUT]\d+/i)
            problemId = pidMatch ? pidMatch[0].toLowerCase() : 'markdown'
        } else { problemId = problemId.toLowerCase() }
        const testCases: { stdin: string; stdout: string; name: string }[] = []
        if (problemData.samples && Array.isArray(problemData.samples) && problemData.samples.length > 0) {
            problemData.samples.forEach((sample, index) => {
                testCases.push({ stdin: sample[0], stdout: sample[1], name: '样例 ' + (index + 1) })
            })
        }
        const fileName = problemId + '.cpp'
        await createAndOpenCppFile(fileName)
        if (w.cphPlugin) {
            if (w.cphPlugin.currentFile !== fileName) {
                if (w.cphPlugin.testCases) { w.cphPlugin.saveTestCases() }
                w.cphPlugin.currentFile = fileName
                w.cphPlugin.testCases = w.cphPlugin.loadTestCases()
                localStorage.setItem('phoi_currentFileName', fileName)
            }
            testCases.forEach(tc => {
                const exists = w.cphPlugin.testCases.some((ec: any) => ec.stdin === tc.stdin && ec.stdout === tc.stdout)
                if (!exists) { w.cphPlugin.testCases.push(tc) }
            })
            w.cphPlugin.saveTestCases()
            w.cphPlugin.renderTestCases()
            w.cphPlugin.renderTestCasesMain()
            showMessage('成功传输 ' + testCases.length + ' 个测试用例到CPH: ' + fileName, 'success')
        } else {
            throw new Error('CPH插件未初始化')
        }
    } catch (error: any) {
        showMessage('传输题目到CPH失败: ' + error.message, 'error')
    }
}

async function translateProblemContent(problemData: ProblemData, translateButton: HTMLButtonElement, originalContent: TranslateContent, translatedContent: TranslateContent, onTranslateComplete: () => void): Promise<void> {
    const colors = getLuoguThemeColors()
    const description = problemData.description || ''
    const inputFormat = problemData.inputFormat || ''
    const outputFormat = problemData.outputFormat || ''
    const hint = problemData.hint || ''
    const fullContentElement = document.getElementById('full-markdown-content')
    const descElement = document.getElementById('problem-description')
    const inputFormatElement = document.getElementById('problem-input-format')
    const outputFormatElement = document.getElementById('problem-output-format')
    const hintElement = document.getElementById('problem-hint')
    const loadingHtml = '<em style="color: ' + colors.btnTranslate + ';">正在翻译...</em>'
    if (fullContentElement) fullContentElement.innerHTML = loadingHtml
    if (descElement) descElement.innerHTML = loadingHtml
    if (inputFormatElement) inputFormatElement.innerHTML = loadingHtml
    if (outputFormatElement) outputFormatElement.innerHTML = loadingHtml
    if (hintElement) hintElement.innerHTML = loadingHtml
    if (translateButton) { translateButton.textContent = '正在翻译...'; translateButton.style.backgroundColor = colors.btnDisabled }
    try {
        const translatePromises: Promise<{ type: string; text: string }>[] = []
        const tr = (type: string, text: string) =>
            fetch('https://tr.hcz1017.dpdns.org/translate', {
                method: 'POST',
                headers: { 'accept': '*/*', 'content-type': 'application/json' },
                body: JSON.stringify({ from: 'en', to: 'zh', text })
            }).then(r => r.json()).then(data => ({
                type,
                text: (data.result || data.translatedText || data.text || '') + '\n\n\n---\n--使用自建机器翻译服务翻译，仅供参考'
            }))
        if (description) translatePromises.push(tr('description', description))
        if (inputFormat) translatePromises.push(tr('inputFormat', inputFormat))
        if (outputFormat) translatePromises.push(tr('outputFormat', outputFormat))
        if (hint) translatePromises.push(tr('hint', hint))
        const results = await Promise.all(translatePromises)
        const renderOptions = {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        }
        results.forEach(item => {
            let element: HTMLElement | null = null
            let originalText = ''
            switch (item.type) {
                case 'description': element = fullContentElement || descElement; originalText = description; if (translatedContent) translatedContent.description = item.text; break
                case 'inputFormat': element = inputFormatElement; originalText = inputFormat; if (translatedContent) translatedContent.inputFormat = item.text; break
                case 'outputFormat': element = outputFormatElement; originalText = outputFormat; if (translatedContent) translatedContent.outputFormat = item.text; break
                case 'hint': element = hintElement; originalText = hint; if (translatedContent) translatedContent.hint = item.text; break
            }
            if (element && item.text) { element.innerHTML = (w.marked as any).parse(item.text); (w.renderMathInElement as any)(element, renderOptions) }
        })
        if (translateButton) { translateButton.textContent = '返回原文'; translateButton.style.backgroundColor = colors.btnError }
        if (onTranslateComplete) onTranslateComplete()
        showMessage('翻译完成', 'success')
    } catch (error: any) {
        const renderOptions = {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        }
        if (fullContentElement) { fullContentElement.innerHTML = (w.marked as any).parse(description); (w.renderMathInElement as any)(fullContentElement, renderOptions) }
        if (descElement && !fullContentElement) { descElement.innerHTML = (w.marked as any).parse(description); (w.renderMathInElement as any)(descElement, renderOptions) }
        if (inputFormatElement) { inputFormatElement.innerHTML = (w.marked as any).parse(inputFormat); (w.renderMathInElement as any)(inputFormatElement, renderOptions) }
        if (outputFormatElement) { outputFormatElement.innerHTML = (w.marked as any).parse(outputFormat); (w.renderMathInElement as any)(outputFormatElement, renderOptions) }
        if (hintElement) { hintElement.innerHTML = (w.marked as any).parse(hint); (w.renderMathInElement as any)(hintElement, renderOptions) }
        if (translateButton) { translateButton.textContent = '翻译'; translateButton.style.backgroundColor = colors.btnTranslate }
        showMessage('翻译失败：' + error.message, 'error')
    }
}

function showMessage(content: string, sender: string): void {
    const msg = document.createElement('div')
    msg.className = 'debug-message ' + sender
    msg.innerHTML = '<strong>' + (sender === 'user' ? '用户:' : '系统:') + '</strong> ' + content
    const terminalInfoContent = document.getElementById('terminal-info-content')
    if (terminalInfoContent) {
        terminalInfoContent.appendChild(msg)
        terminalInfoContent.scrollTop = terminalInfoContent.scrollHeight
        if (typeof w.switchTerminalTab === 'function') w.switchTerminalTab('info')
        const terminalPanel = document.getElementById('terminal-panel')
        if (terminalPanel) {
            terminalPanel.style.display = 'flex'
            setTimeout(() => { terminalPanel.style.display = 'none' }, 3000)
        }
    }
}

window.addEventListener('resize', function () {
    const colors = getLuoguThemeColors()
    const problemDisplay = document.getElementById('problem-display')
    if (problemDisplay && problemDisplay.style.display !== 'none') {
        const isMobile = !(window as any).isFullMode
        if (isMobile) {
            problemDisplay.style.position = 'fixed'
            problemDisplay.style.top = '36px'
            problemDisplay.style.left = '0'
            problemDisplay.style.right = '0'
            problemDisplay.style.bottom = '0'
            problemDisplay.style.width = 'auto'
            problemDisplay.style.height = 'auto'
        } else {
            problemDisplay.style.position = 'fixed'
            problemDisplay.style.top = '36px'
            problemDisplay.style.right = '0'
            problemDisplay.style.width = '400px'
            problemDisplay.style.height = 'calc(100vh - 36px)'
            problemDisplay.style.borderLeft = '1px solid ' + colors.border
        }
    }
})

window.addEventListener('storage', function (e: StorageEvent) {
    if (e.key === 'phoi_luogu_theme_enabled') {
        const checkbox = document.getElementById('luogu-theme-enabled') as HTMLInputElement | null
        if (checkbox) { checkbox.checked = e.newValue === 'true' }
    }
})

export { getLuoguThemeColors, showLuoguProblemDialog, loadLuoguProblem, createProblemDisplayArea, displayLuoguProblem, renderMarkdownAndLatex, showMessage, transferProblemToCPH, createAndOpenCppFile }
