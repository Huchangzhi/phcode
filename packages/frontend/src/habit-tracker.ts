interface HabitData {
    selectionCounts: Record<string, number>
    contextPairs: Record<string, number>
    preferredHeaders: string[]
    lastUpdated: number | null
}

const getCodeFeatures = () => (window as any).CodeFeatures

interface Suggestion {
    label: string
    sortText?: string
    [key: string]: any
}

const STORAGE_KEY = 'phoi_userHabits'

let data: HabitData = {
    selectionCounts: {},
    contextPairs: {},
    preferredHeaders: [],
    lastUpdated: null
}

function loadFromStorage(): void {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            data = JSON.parse(stored)
        }
    } catch (e) {
        console.error('[HabitTracker] 加载数据失败:', e)
        data = { selectionCounts: {}, contextPairs: {}, preferredHeaders: [], lastUpdated: null }
    }
}

function saveToStorage(): void {
    try {
        data.lastUpdated = Date.now()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
        console.error('[HabitTracker] 保存数据失败:', e)
    }
}

function setupMonacoListener(): void {
    const setup = () => {
        if (typeof (window as any).monacoEditor !== 'undefined' && (window as any).monacoEditor) {
            let prefixBeforeChange: string | null = null;
            const me = (window as any).monacoEditor;
            me.onKeyDown((e: { keyCode: number }) => {
                if (e.keyCode === 2 || e.keyCode === 3) {
                    const model = me.getModel()
                    const position = me.getPosition()
                    const word = model.getWordUntilPosition(position)
                    if (word && word.word && word.word.length >= 1) {
                        prefixBeforeChange = word.word
                        setTimeout(() => { prefixBeforeChange = null }, 200)
                    }
                }
            })
            me.onDidChangeModelContent((e: { changes: { text: string; rangeLength: number }[] }) => {
                const model = me.getModel()
                const position = me.getPosition()
                const word = model.getWordUntilPosition(position)
                const currentWord = word ? word.word : ''
                for (const change of e.changes) {
                    const text = change.text
                    const rangeLength = change.rangeLength || 0
                    const netInsertLength = text.length - rangeLength
                    const prefix = prefixBeforeChange || (currentWord && currentWord.length >= 1 ? currentWord : null)
                    if (netInsertLength >= 2 && text.length >= 3 && prefix && text.startsWith(prefix)) {
                        recordSelection(text, prefix, 'completion_accept')
                        prefixBeforeChange = null
                    }
                }
            })
            me.onDidChangeCursorSelection((e: { source: string; selection: { getPosition: () => any } }) => {
                if (e.source === 'acceptSuggestion') {
                    const model = me.getModel()
                    const position = e.selection.getPosition()
                    const word = model.getWordUntilPosition(position)
                    const prefix = prefixBeforeChange || ''
                    if (word && word.word && word.word.length >= 2) {
                        recordSelection(word.word, prefix, 'suggestion_accepted')
                    }
                }
            })
        } else {
            setTimeout(setup, 500)
        }
    }
    setTimeout(setup, 1000)
}

function recordSelection(label: string, prefix = '', _context = ''): void {
    const normalizedLabel = label.replace(/\(\)$/, '')
    if (!data.selectionCounts[normalizedLabel]) {
        data.selectionCounts[normalizedLabel] = 0
    }
    data.selectionCounts[normalizedLabel]++
    if (prefix) {
        const contextKey = `${prefix}->${normalizedLabel}`
        if (!data.contextPairs[contextKey]) {
            data.contextPairs[contextKey] = 0
        }
        data.contextPairs[contextKey]++
    }
    if (label.includes('.') || label.startsWith('<') || label.endsWith('>')) {
        const headerName = label.replace(/[<>]/g, '')
        if (!data.preferredHeaders.includes(headerName)) {
            data.preferredHeaders.push(headerName)
        }
    }
    saveToStorage()
}

function getScore(label: string, prefix = ''): number {
    let score = 0
    const selectionCount = data.selectionCounts[label] || 0
    score += Math.log10(selectionCount + 1) * 1000
    const contextKey = `${prefix}->${label}`
    const contextCount = data.contextPairs[contextKey] || 0
    score += Math.log10(contextCount + 1) * 2000
    const headerName = label.replace(/[<>]/g, '')
    if (data.preferredHeaders.includes(headerName)) {
        score += 500
    }
    return score
}

function sortSuggestions(suggestions: Suggestion[], prefix = '', code = '', cursorPos = 0): Suggestion[] {
    let features = null
    if (typeof getCodeFeatures() === 'function' && code && typeof cursorPos === 'number') {
        const featureExtractor = new (getCodeFeatures())()
        features = featureExtractor.extract(code, cursorPos, prefix)
    }
    const lm = (window as any).LightModel
    const hasLightModel = typeof lm !== 'undefined'
    const modelLoaded = lm ? lm.loaded : false
    const scored = suggestions.map((s) => {
        const habitScore = getScore(s.label, prefix)
        let aiScore = 0
        if (features && hasLightModel && modelLoaded) {
            aiScore = lm.getContextScore(s.label, features)
        }
        const totalScore = habitScore * 0.5 + aiScore * 0.5
        const score1 = Math.min(25, Math.floor(totalScore / 400))
        const score2 = Math.min(25, Math.floor((totalScore % 400) / 16))
        const score3 = Math.min(25, Math.floor((totalScore % 16) / 1.5))
        const score4 = Math.min(25, Math.floor((totalScore % 1.5) * 15))
        const sortPrefix = String.fromCharCode(122 - score1) +
            String.fromCharCode(122 - score2) +
            String.fromCharCode(122 - score3) +
            String.fromCharCode(122 - score4)
        return { ...s, _score: totalScore, _habitScore: habitScore, _aiScore: aiScore, sortText: sortPrefix + (s.sortText || s.label) }
    })
    return scored.sort((a, b) => b._score - a._score)
}

function getTopHeaders(limit = 10): string[] {
    return data.preferredHeaders.slice(0, limit)
}

function getStats() {
    return {
        totalSelections: Object.values(data.selectionCounts).reduce((a, b) => a + b, 0),
        uniqueLabels: Object.keys(data.selectionCounts).length,
        contextPairs: Object.keys(data.contextPairs).length,
        preferredHeaders: data.preferredHeaders.length,
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '从未'
    }
}

function clearData(): void {
    data.selectionCounts = {}
    data.contextPairs = {}
    data.preferredHeaders = []
    data.lastUpdated = null
    saveToStorage()
    console.log('[HabitTracker] 已清除用户数据')
}

function debug(): Record<string, any> {
    console.log('=== HabitTracker 调试信息 ===')
    console.log('统计信息:', getStats())
    console.log('选择次数前 20:', Object.entries(data.selectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log('常用头文件:', getTopHeaders(20))
    console.log('上下文关联前 10:', Object.entries(data.contextPairs).sort((a, b) => b[1] - a[1]).slice(0, 10))
    return getStats()
}

function checkStorage(): HabitData | null {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
        console.log('[HabitTracker] localStorage 中没有数据，键名:', STORAGE_KEY)
        return null
    }
    try {
        const storedData = JSON.parse(stored)
        console.log('[HabitTracker] localStorage 中的数据:')
        console.log('  - 选择计数:', Object.keys(storedData.selectionCounts || {}).length, '项')
        console.log('  - 上下文关联:', Object.keys(storedData.contextPairs || {}).length, '项')
        console.log('  - 常用头文件:', (storedData.preferredHeaders || []).length, '项')
        console.log('  - 最后更新:', storedData.lastUpdated ? new Date(storedData.lastUpdated).toLocaleString() : '无')
        return storedData
    } catch (e) {
        console.error('[HabitTracker] 解析 localStorage 数据失败:', e)
        return null
    }
}

function testRecord(): Record<string, any> {
    console.log('[HabitTracker] 测试记录功能...')
    recordSelection('vector', 'vec', 'test')
    recordSelection('iostream', '', 'test')
    saveToStorage()
    console.log('[HabitTracker] 测试完成！请检查 localStorage 中是否有 phoi_userHabits 数据')
    return debug()
}

function reset(): void {
    clearData()
    console.log('[HabitTracker] 已重置，可以开始重新学习你的习惯')
}

export const HabitTracker = {
    STORAGE_KEY,
    get data() { return data },
    init: function () {
        loadFromStorage()
        setupMonacoListener()
    },
    setupMonacoListener,
    recordExposure: function (_label: string, _prefix = '', _rank = 100) {},
    loadFromStorage,
    saveToStorage,
    recordSelection,
    getScore,
    sortSuggestions,
    getTopHeaders,
    getStats,
    clearData,
    debug,
    checkStorage,
    testRecord,
    reset
}

// Auto-initialize
HabitTracker.init()
;(window as any).HabitTracker = HabitTracker
console.log('[HabitTracker] 已加载，使用 HabitTracker.checkStorage() 检查数据，HabitTracker.debug() 查看详细信息')
