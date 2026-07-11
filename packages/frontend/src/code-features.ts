interface CodeFeaturesResult {
    prefix: string
    prefixLength: number
    isInInclude: boolean
    isAfterDot: boolean
    isAfterHash: boolean
    isForLoop: boolean
    isDeclaration: boolean
    nestingLevel: number
    tokenType: string
    prevTokens: string[]
    variableType: string
    isCommonVar: boolean
    isKeyword: boolean
    isSTL: boolean
    includedHeaders: Set<string>
}

class CodeFeatures {
    private keywords: Set<string>
    private commonVars: Set<string>
    private stlContainers: Set<string>
    private commonHeaders: Set<string>

    constructor() {
        this.keywords = new Set([
            'int', 'void', 'double', 'float', 'char', 'bool', 'long', 'short',
            'unsigned', 'signed', 'const', 'static', 'extern', 'register',
            'if', 'else', 'switch', 'case', 'default', 'break', 'continue',
            'for', 'while', 'do', 'return', 'goto',
            'struct', 'class', 'union', 'enum', 'namespace', 'using',
            'public', 'private', 'protected', 'virtual', 'friend',
            'try', 'catch', 'throw', 'new', 'delete',
            'true', 'false', 'nullptr', 'this',
            'auto', 'decltype', 'constexpr', 'template', 'typename',
            'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma'
        ])
        this.commonVars = new Set([
            'n', 'm', 'k', 'x', 'y', 'z', 'a', 'b', 'c', 'd',
            'i', 'j', 't', 'cnt', 'ans', 'sum', 'max', 'min',
            'vis', 'dp', 'dfs', 'bfs', 'lca', 'gcd', 'lcm'
        ])
        this.stlContainers = new Set([
            'vector', 'string', 'map', 'set', 'queue', 'stack',
            'deque', 'list', 'array', 'priority_queue',
            'unordered_map', 'unordered_set', 'multiset', 'multimap'
        ])
        this.commonHeaders = new Set([
            'iostream', 'cstdio', 'cstring', 'cmath', 'algorithm',
            'vector', 'string', 'map', 'set', 'queue', 'stack',
            'cstdlib', 'climits', 'cctype', 'iomanip', 'fstream'
        ])
    }

    extract(code: string, cursorPos: number, prefix = ''): CodeFeaturesResult {
        const textBefore = code.substring(0, cursorPos)
        const lines = textBefore.split('\n')
        const currentLine = lines[lines.length - 1] || ''

        return {
            prefix,
            prefixLength: prefix.length,
            isInInclude: this.checkInIncludeContext(textBefore, currentLine),
            isAfterDot: currentLine.trimEnd().endsWith('.'),
            isAfterHash: currentLine.trimEnd().endsWith('#'),
            isForLoop: this.checkInForLoop(textBefore, currentLine),
            isDeclaration: this.checkInDeclaration(textBefore, currentLine),
            nestingLevel: this.getNestingLevel(textBefore),
            tokenType: this.getTokenType(prefix, textBefore),
            prevTokens: this.getPreviousTokens(textBefore, 3),
            variableType: this.inferVariableType(textBefore, prefix),
            isCommonVar: this.commonVars.has(prefix),
            isKeyword: this.keywords.has(prefix),
            isSTL: this.stlContainers.has(prefix),
            includedHeaders: this.getIncludedHeaders(code)
        }
    }

    private checkInIncludeContext(_textBefore: string, currentLine: string): boolean {
        return /#include\s*</.test(currentLine) ||
            /#include\s*$/.test(currentLine) ||
            /#include\s+[^<"]*$/.test(currentLine)
    }

    private checkInForLoop(_textBefore: string, currentLine: string): boolean {
        return /\bfor\s*\([^)]*$/.test(currentLine) ||
            /\bfor\s*$/.test(currentLine)
    }

    private checkInDeclaration(_textBefore: string, currentLine: string): boolean {
        return /^\s*(int|long|double|float|char|bool|auto|void|const|unsigned|signed)\s+\w*$/.test(currentLine) ||
            /^\s*(vector|string|map|set|queue|stack)\s*<[^>]*>\s+\w*$/.test(currentLine) ||
            /^\s*(vector|string|map|set|queue|stack)\s+\w*$/.test(currentLine)
    }

    private getNestingLevel(textBefore: string): number {
        const openBraces = (textBefore.match(/\{/g) || []).length
        const closeBraces = (textBefore.match(/\}/g) || []).length
        return Math.max(0, openBraces - closeBraces)
    }

    private getTokenType(token: string, _textBefore: string): string {
        if (!token) return 'empty'
        if (this.keywords.has(token)) return 'keyword'
        if (this.commonVars.has(token)) return 'common_var'
        if (this.stlContainers.has(token)) return 'stl'
        if (/^[A-Z]/.test(token)) return 'type'
        if (/^\d/.test(token)) return 'number'
        return 'identifier'
    }

    private getPreviousTokens(textBefore: string, count = 3): string[] {
        const cleanText = textBefore.replace(/\/\/.*$/gm, '')
        const tokens = cleanText.match(/[a-zA-Z_]\w*|[+\-*/%=<>!&|^~?:;,.()\[\]{}]/g) || []
        return tokens.slice(-count)
    }

    private inferVariableType(textBefore: string, varName: string): string {
        if (!varName) return 'unknown'
        const declPatterns = [
            new RegExp(`\\b(int|long|long\\s+long|double|float|char|bool)\\s+${varName}\\b`, 'g'),
            new RegExp(`\\b(vector|string|map|set|queue|stack)\\s*(?:<[^>]*>)?\\s+${varName}\\b`, 'g'),
            new RegExp(`\\b(auto)\\s+${varName}\\s*=\\s*([^;]+)`, 'g')
        ]
        for (const pattern of declPatterns) {
            const match = pattern.exec(textBefore)
            if (match) {
                return match[1]
            }
        }
        return 'unknown'
    }

    private getIncludedHeaders(code: string): Set<string> {
        const headers = new Set<string>()
        const matches = code.matchAll(/#include\s*<([^>]+)>/g)
        for (const match of matches) {
            headers.add(match[1])
        }
        return headers
    }

    toVector(features: CodeFeaturesResult): number[] {
        const vector: number[] = []
        vector.push(features.prefixLength)
        vector.push(features.nestingLevel)
        vector.push(features.isInInclude ? 1 : 0)
        vector.push(features.isAfterDot ? 1 : 0)
        vector.push(features.isAfterHash ? 1 : 0)
        vector.push(features.isForLoop ? 1 : 0)
        vector.push(features.isDeclaration ? 1 : 0)
        vector.push(features.isCommonVar ? 1 : 0)
        vector.push(features.isKeyword ? 1 : 0)
        vector.push(features.isSTL ? 1 : 0)
        const tokenTypeMap: Record<string, number> = {
            'empty': 0, 'keyword': 1, 'common_var': 2, 'stl': 3,
            'type': 4, 'number': 5, 'identifier': 6
        }
        vector.push(tokenTypeMap[features.tokenType] || 0)
        const varTypeMap: Record<string, number> = {
            'unknown': 0, 'int': 1, 'long': 2, 'double': 3,
            'float': 4, 'char': 5, 'bool': 6, 'vector': 7,
            'string': 8, 'map': 9, 'set': 10, 'auto': 11
        }
        vector.push(varTypeMap[features.variableType] || 0)
        return vector
    }
}

(window as any).CodeFeatures = CodeFeatures
export default CodeFeatures
