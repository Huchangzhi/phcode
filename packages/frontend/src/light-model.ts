interface NGramTable {
    unigram?: Record<string, number>
    bigram?: Record<string, number[]>
    trigram?: Record<string, number[]>
    includes?: Record<string, number>
    for_vars?: Record<string, number>
}

type NGramLevel = 'trigram' | 'bigram' | 'unigram'

interface ScoredSuggestion {
    label: string
    _aiScore: number
    _aiFactors: { ngram: number; context: number; frequency: number }
    [key: string]: any
}

export class LightModel {
    private ngramTable: NGramTable | null = null
    loaded = false
    private loadPromise: Promise<void> | null = null

    constructor() {
        this.load()
    }

    async load(): Promise<void> {
        if (this.loadPromise) return this.loadPromise
        this.loadPromise = (async () => {
            try {
                const response = await fetch('/static/models/ngram_table.json.gz.data')
                if (!response.ok) throw new Error('Failed to load ngram table')
                const compressed = await response.arrayBuffer()
                const decompressed = await this.decompressGzip(compressed)
                this.ngramTable = JSON.parse(decompressed)
                this.loaded = true
            } catch (_error) {
                console.warn('[LightModel] 加载失败，使用备用方案:', _error)
                try {
                    const response = await fetch('/static/models/ngram_table.json')
                    if (response.ok) {
                        this.ngramTable = await response.json()
                        this.loaded = true
                        console.log('[LightModel] 模型已加载（未压缩版本）')
                    }
                } catch (_e) {
                    console.warn('[LightModel] 使用内置默认模型')
                    this.ngramTable = this.getDefaultModel()
                    this.loaded = true
                }
            }
        })()
        return this.loadPromise
    }

    private async decompressGzip(arrayBuffer: ArrayBuffer): Promise<string> {
        try {
            const blob = new Blob([arrayBuffer])
            const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
            const text = await new Response(stream).text()
            return text
        } catch (_e) {
            return new TextDecoder().decode(arrayBuffer)
        }
    }

    private getDefaultModel(): NGramTable {
        return {
            unigram: {
                'i': 5000, 'j': 2000, 'n': 3000, 'm': 1500,
                'int': 2000, 'for': 1500, 'if': 1800, 'else': 1000,
                'return': 1200, 'cin': 800, 'cout': 800,
                'vector': 600, 'string': 500, 'map': 400, 'set': 300
            },
            includes: {
                'iostream': 500, 'cstdio': 300, 'cstring': 200,
                'cmath': 250, 'algorithm': 400, 'vector': 350,
                'string': 300, 'map': 250, 'set': 200
            },
            for_vars: {
                'i': 1366, 'j': 357, 'k': 70
            }
        }
    }

    getNGramProb(tokens: string[], n = 3): number {
        if (!this.ngramTable) return 0
        const key = tokens.join(' ')
        const tableKey = (n === 3 ? 'trigram' : n === 2 ? 'bigram' : 'unigram') as NGramLevel
        const table = this.ngramTable[tableKey]
        if (!table || !(key in table)) {
            if (n > 1) return this.getNGramProb(tokens.slice(1), n - 1)
            return 0.01
        }
        const entry = table[key]
        if (typeof entry === 'number') {
            return entry / (Object.values(table) as number[]).reduce((a, b) => a + b, 0)
        }
        const total = entry.reduce((a: number, b: number) => a + b, 0)
        return entry[0] / total
    }

    getIncludeProb(header: string): number {
        if (!this.ngramTable?.includes) return 0
        const count = this.ngramTable.includes[header] || 0
        const total = Object.values(this.ngramTable.includes).reduce((a, b) => a + b, 0)
        return count / total
    }

    getForVarProb(varName: string): number {
        if (!this.ngramTable?.for_vars) return 0
        const count = this.ngramTable.for_vars[varName] || 0
        const total = Object.values(this.ngramTable.for_vars).reduce((a, b) => a + b, 0)
        return count / total
    }

    getUnigramFreq(token: string): number {
        if (!this.ngramTable?.unigram) return 0
        return this.ngramTable.unigram[token] || 0
    }

    scoreSuggestions(suggestions: { label: string }[], features: any): ScoredSuggestion[] {
        if (!this.loaded || !this.ngramTable) {
            return suggestions.map(s => ({
                ...s,
                _aiScore: 0,
                _aiFactors: { ngram: 0, context: 0, frequency: 0 }
            }))
        }
        return suggestions.map(suggestion => {
            const label = suggestion.label
            const cleanLabel = label.replace(/[()<>]/g, '').split(/[<\(]/)[0]
            let score = 0
            const factors = { ngram: 0, context: 0, frequency: 0 }
            if (features.prevTokens && features.prevTokens.length >= 2) {
                const tokens3 = [...features.prevTokens.slice(-2), cleanLabel]
                const tokens2 = [...features.prevTokens.slice(-1), cleanLabel]
                const prob3 = this.getNGramProb(tokens3, 3)
                const prob2 = this.getNGramProb(tokens2, 2)
                factors.ngram = (prob3 * 300 + prob2 * 200) * 1000
            }
            if (features.isInInclude) {
                factors.context = this.getIncludeProb(cleanLabel) * 5000
            } else if (features.isForLoop) {
                factors.context = this.getForVarProb(cleanLabel) * 3000
            } else if (features.isAfterDot) {
                const commonMethods = ['push_back', 'size', 'begin', 'end', 'clear', 'empty', 'insert', 'erase']
                if (commonMethods.includes(cleanLabel)) factors.context = 200
            } else if (features.isDeclaration && features.variableType !== 'unknown') {
                factors.context = 150
            }
            const freq = this.getUnigramFreq(cleanLabel)
            factors.frequency = Math.min(200, Math.log10(freq + 1) * 50)
            score = factors.ngram + factors.context + factors.frequency
            return { ...suggestion, _aiScore: score, _aiFactors: factors }
        })
    }

    getScore(suggestion: { label: string }, features: any): number {
        if (!this.loaded || !this.ngramTable) return 0
        const scored = this.scoreSuggestions([suggestion], features)
        return scored[0]._aiScore || 0
    }

    getContextScore(label: string, features: any): number {
        if (!this.loaded || !this.ngramTable) return 0
        const cleanLabel = label.replace(/[()<>]/g, '').split(/[<\(]/)[0]
        let score = 0
        if (features.isInInclude) {
            score += this.getIncludeProb(cleanLabel) * 10000
        }
        if (features.isForLoop) {
            score += this.getForVarProb(cleanLabel) * 5000
        }
        const freq = this.getUnigramFreq(cleanLabel)
        score += Math.min(300, Math.log10(freq + 1) * 80)
        return score
    }

    getStats(): Record<string, number> | null {
        if (!this.ngramTable) return null
        return {
            unigramCount: Object.keys(this.ngramTable.unigram || {}).length,
            bigramCount: Object.keys(this.ngramTable.bigram || {}).length,
            trigramCount: Object.keys(this.ngramTable.trigram || {}).length,
            includeCount: Object.keys(this.ngramTable.includes || {}).length,
            forVarCount: Object.keys(this.ngramTable.for_vars || {}).length
        }
    }
}

export function createLightModel(): LightModel {
    return new LightModel()
}

// @ts-ignore
window.LightModel = new LightModel()
// @ts-ignore
window.LightModelClass = LightModel
