class MobileAutocomplete {
    private editorContainer: HTMLElement | null
    private keyboardContainer: HTMLElement | null
    private suggestionsContainer: HTMLElement | null = null
    private currentSuggestions: string[] = []
    private globalText = ''
    private globalCursorPos = 0

    private cppKeywords = [
        'if', 'else', 'switch', 'case', 'default', 'break', 'continue', 'goto',
        'while', 'do', 'for', 'return', 'extern', 'inline',
        'void', 'bool', 'char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t', 'short', 'int', 'long', 'float', 'double',
        'signed', 'unsigned', 'typedef', 'const', 'volatile', 'static', 'auto', 'register', 'mutable',
        'class', 'struct', 'union', 'enum', 'public', 'private', 'protected', 'friend', 'virtual', 'override', 'final',
        'this', 'explicit', 'constexpr', 'consteval', 'constinit',
        'public', 'private', 'protected', 'virtual', 'override',
        'static', 'extern', 'register', 'mutable',
        'new', 'delete', 'sizeof', 'typeid', 'dynamic_cast', 'static_cast', 'reinterpret_cast', 'const_cast',
        'namespace', 'using', 'template', 'typename', 'decltype', 'concept', 'requires',
        'try', 'catch', 'throw', 'noexcept',
        'true', 'false', 'nullptr', 'asm', 'thread_local', 'alignas', 'alignof'
    ]

    private cppFunctions = [
        'printf', 'scanf', 'fprintf', 'fscanf', 'sscanf', 'sprintf', 'snprintf',
        'getchar', 'putchar', 'gets', 'puts', 'fgets', 'fputs', 'fclose', 'fflush',
        'malloc', 'calloc', 'realloc', 'free', 'abs', 'labs', 'llabs', 'atoi', 'atol', 'atoll',
        'atof', 'rand', 'srand', 'qsort', 'bsearch',
        'memcpy', 'memset', 'strcpy', 'strncpy', ' strcat', 'strncat',
        'memcmp', 'strcmp', 'strncmp', 'strlen', 'strchr', 'strstr',
        'make_pair', 'swap', 'forward', 'move',
        'sort', 'reverse', 'lower_bound', 'upper_bound', 'find', 'count', 'max', 'min',
        'max_element', 'min_element', 'unique', 'remove', 'fill', 'next_permutation', 'prev_permutation',
        'make_unique', 'make_shared', 'unique_ptr', 'shared_ptr', 'weak_ptr',
        'min', 'max', 'sqrt', 'pow'
    ]

    private cppObjects = [
        'cin', 'cout', 'cerr', 'clog', 'endl', 'ws', 'flush',
        'setw', 'setprecision', 'setfill', 'setbase', 'hex', 'dec', 'oct', 'fixed', 'scientific'
    ]

    private stlContainers = [
        'vector', 'queue', 'stack', 'set', 'multiset', 'map', 'multimap',
        'unordered_set', 'unordered_map', 'priority_queue', 'deque', 'list',
        'array', 'pair', 'string'
    ]

    private cppHeaders = [
        'bits/stdc++.h', 'iostream', 'ostream', 'istream', 'fstream', 'sstream',
        'vector', 'list', 'deque', 'array', 'forward_list', 'queue', 'stack',
        'map', 'set', 'unordered_map', 'unordered_set', 'multimap', 'multiset',
        'string', 'cstring', 'string_view',
        'algorithm', 'iterator', 'functional', 'utility',
        'memory', 'memory_resource',
        'chrono', 'ratio', 'time',
        'random', 'numeric', 'complex', 'valarray',
        'exception', 'stdexcept', 'system_error',
        'locale', 'codecvt',
        'regex', 'filesystem',
        'atomic', 'thread', 'mutex', 'shared_mutex', 'future',
        'iostream', 'iomanip', 'iosfwd',
        'cstdio', 'cstdlib', 'cctype', 'cstring', 'cmath', 'ctime',
        'cassert', 'cerrno', 'cfloat', 'ciso646', 'climits', 'clocale',
        'cmplx', 'csignal', 'csetjmp', 'cstdarg', 'cstdbool', 'cstddef',
        'cstdint', 'ctgmath', 'cuchar', 'cwchar', 'cwctype'
    ]

    private preprocessorDirectives = [
        'include', 'define', 'undef', 'ifdef', 'ifndef', 'if', 'elif', 'else', 'endif',
        'pragma', 'error', 'line'
    ]

    constructor(editorContainer: HTMLElement | null, keyboardContainer: HTMLElement | null) {
        this.editorContainer = editorContainer
        this.keyboardContainer = keyboardContainer
        this.init()
    }

    private init(): void {
        this.createSuggestionsContainer()
        this.bindEvents()
    }

    private createSuggestionsContainer(): void {
        this.suggestionsContainer = document.getElementById('mobile-autocomplete-container')
        if (!this.suggestionsContainer) {
            console.error('Mobile autocomplete container not found!')
            return
        }
        this.setupKeyboardObserver()
    }

    private setupKeyboardObserver(): void {
        const toggleBtn = document.getElementById('mode-toggle-btn')
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.adjustVisibility()
                }, 100)
            })
        }
        this.adjustVisibility()
    }

    private adjustVisibility(): void {
        if (typeof window.isFullMode !== 'undefined') {
            if (window.isFullMode) {
                if (this.suggestionsContainer) {
                    this.suggestionsContainer.style.display = 'none'
                }
            } else {
                if (this.suggestionsContainer) {
                    this.suggestionsContainer.style.display = 'flex'
                }
            }
        } else {
            const keyboardContainer = document.getElementById('keyboard-container')
            if (keyboardContainer && this.suggestionsContainer) {
                if (keyboardContainer.classList.contains('hide-keyboard')) {
                    this.suggestionsContainer.style.display = 'none'
                } else {
                    this.suggestionsContainer.style.display = 'flex'
                }
            }
        }
    }

    private bindEvents(): void {
        window.addEventListener('codeUpdated', () => {
            this.updateAutocomplete()
        })
    }

    triggerUpdate(): void {
        this.updateAutocomplete()
    }

    private updateAutocomplete(): void {
        if (typeof globalText !== 'undefined') {
            this.globalText = globalText
        }
        if (typeof globalCursorPos !== 'undefined') {
            this.globalCursorPos = globalCursorPos
        }
        const suggestions = this.calculateSuggestions()
        this.showSuggestions(suggestions)
    }

    private calculateSuggestions(): string[] {
        const textBeforeCursor = this.globalText.substring(0, this.globalCursorPos)

        if (textBeforeCursor.trim().endsWith('#')) {
            return this.preprocessorDirectives.slice(0, 10)
        }

        if (/#include\s*$/.test(textBeforeCursor.trim())) {
            return this.cppHeaders.map(h => `<${h}>`).slice(0, 10)
        }

        if (/#include\s*<[^>]*$/.test(textBeforeCursor)) {
            const match = textBeforeCursor.match(/#include\s*<([^>]*)$/)
            if (match) {
                const currentInput = match[1]
                if (currentInput) {
                    return this.cppHeaders
                        .filter(h => h.toLowerCase().startsWith(currentInput.toLowerCase()))
                        .map(h => `<${h}>`)
                        .slice(0, 10)
                } else {
                    return this.cppHeaders.map(h => `<${h}>`).slice(0, 10)
                }
            }
        }

        const lastWordMatch = textBeforeCursor.match(/[\w]+$/)
        const lastChar = textBeforeCursor.slice(-1)

        if (/[a-zA-Z_]/.test(lastChar)) {
            const currentWord = lastWordMatch ? lastWordMatch[0] : ''

            let suggestions: string[] = []

            if (textBeforeCursor.endsWith('.')) {
                suggestions = this.getMemberSuggestions(textBeforeCursor)
            } else {
                suggestions = this.getGeneralSuggestions(currentWord)
            }

            if (currentWord) {
                suggestions = suggestions.filter(suggestion =>
                    suggestion.toLowerCase().startsWith(currentWord.toLowerCase())
                ).slice(0, 10)
            } else {
                suggestions = suggestions.slice(0, 5)
            }

            return suggestions
        }

        return []
    }

    private getGeneralSuggestions(currentWord: string): string[] {
        let suggestions: string[] = []

        const textBeforeCursor = this.globalText.substring(0, this.globalCursorPos)

        if (textBeforeCursor.trim().endsWith('#include')) {
            suggestions = suggestions.concat(this.cppHeaders.map(h => `<${h}>`))
        } else if (textBeforeCursor.trim().endsWith('#')) {
            suggestions = suggestions.concat(this.preprocessorDirectives)
        } else {
            suggestions = suggestions.concat(this.cppKeywords)
            suggestions = suggestions.concat(this.cppFunctions.map(fn => fn + '()'))
            suggestions = suggestions.concat(this.cppObjects)
            suggestions = suggestions.concat(this.stlContainers)

            const codeSuggestions = this.extractIdentifiersFromCode()
            suggestions = suggestions.concat(codeSuggestions)
        }

        suggestions = [...new Set(suggestions)]

        if (typeof HabitTracker !== 'undefined' && HabitTracker.sortSuggestions) {
            const prefix = currentWord || ''
            const suggestionObjects = suggestions.map(s => ({
                label: s,
                kind: this.getSuggestionKind(s),
                insertText: s,
                range: { startColumn: 1, endColumn: 1 }
            }))
            const sorted = HabitTracker.sortSuggestions(suggestionObjects, prefix, this.globalText, this.globalCursorPos)
            suggestions = sorted.map((s: any) => s.label)
        }

        return suggestions
    }

    private getSuggestionKind(suggestion: string): number {
        if (this.cppKeywords.includes(suggestion)) return 17
        if (this.cppFunctions.includes(suggestion.replace('()', ''))) return 3
        if (this.cppObjects.includes(suggestion)) return 6
        if (this.stlContainers.includes(suggestion)) return 7
        if (this.preprocessorDirectives.includes(suggestion)) return 17
        if (suggestion.startsWith('<') && suggestion.endsWith('>')) return 9
        return 6
    }

    private getMemberSuggestions(textBeforeCursor: string): string[] {
        const beforeDot = textBeforeCursor.slice(0, -1)

        let identifier = ''
        const arrayMatch = beforeDot.match(/([a-zA-Z_]\w*)\s*\[\s*[^\]]+\s*\]\s*$/)
        if (arrayMatch) {
            identifier = arrayMatch[1]
        } else {
            const identifierMatch = beforeDot.match(/[\w]+$/)
            identifier = identifierMatch ? identifierMatch[0] : ''
        }

        if (identifier) {
            const structDefs = this.parseStructDefinitions(this.globalText)
            const varTypes = this.inferVariableTypes(this.globalText, structDefs)

            if (varTypes[identifier] && varTypes[identifier].isStruct) {
                const structName = varTypes[identifier].type
                const structDef = structDefs[structName]

                if (structDef) {
                    return structDef.members.map((member: any) => {
                        if (member.isFunction) {
                            return member.name + '()'
                        } else {
                            return member.name
                        }
                    })
                }
            }

            if (this.stlContainers.includes(identifier)) {
                return this.getSTLMethodSuggestions(identifier)
            } else {
                return ['begin()', 'end()', 'size()', 'empty()', 'clear()']
            }
        }

        return []
    }

    private getSTLMethodSuggestions(containerType: string): string[] {
        const methodMap: Record<string, string[]> = {
            'vector': ['begin()', 'end()', 'rbegin()', 'rend()', 'size()', 'max_size()', 'resize()', 'empty()', 'reserve()', 'capacity()', 'shrink_to_fit()', 'clear()', 'insert()', 'erase()', 'push_back()', 'pop_back()', 'resize()', 'swap()', 'at()', 'front()', 'back()', 'data()', 'assign()', 'emplace()', 'emplace_back()', 'operator[]'],
            'queue': ['push()', 'pop()', 'front()', 'back()', 'empty()', 'size()'],
            'stack': ['push()', 'pop()', 'top()', 'empty()', 'size()'],
            'set': ['begin()', 'end()', 'rbegin()', 'rend()', 'find()', 'count()', 'lower_bound()', 'upper_bound()', 'equal_range()', 'insert()', 'erase()', 'clear()', 'swap()', 'size()', 'max_size()', 'empty()'],
            'map': ['begin()', 'end()', 'rbegin()', 'rend()', 'find()', 'count()', 'lower_bound()', 'upper_bound()', 'equal_range()', 'insert()', 'emplace()', 'erase()', 'clear()', 'swap()', 'at()', 'operator[]', 'size()', 'max_size()', 'empty()'],
            'string': ['begin()', 'end()', 'rbegin()', 'rend()', 'size()', 'length()', 'max_size()', 'resize()', 'capacity()', 'reserve()', 'clear()', 'empty()', 'shrink_to_fit()', 'operator[]', 'at()', 'back()', 'front()', 'c_str()', 'data()', 'substr()', 'copy()', 'compare()', 'find()', 'rfind()', 'find_first_of()', 'find_last_of()', 'find_first_not_of()', 'find_last_not_of()', 'append()', 'operator+=', 'push_back()', 'assign()', 'insert()', 'erase()', 'replace()', 'swap()', 'getline()'],
            'pair': ['first', 'second'],
            'deque': ['front()', 'back()', 'push_front()', 'push_back()', 'pop_front()', 'pop_back()']
        }

        return methodMap[containerType] || ['begin()', 'end()', 'size()', 'empty()', 'clear()']
    }

    private parseStructDefinitions(code: string): Record<string, any> {
        const structDefs: Record<string, any> = {}

        const structRegex = /\bstruct\s+([a-zA-Z_]\w*)\s*\{([^}]*)\}\s*([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)?\s*;/g
        let match: RegExpExecArray | null

        while ((match = structRegex.exec(code)) !== null) {
            const structName = match[1]
            const membersStr = match[2]
            const members = this.parseStructMembers(membersStr)

            structDefs[structName] = {
                name: structName,
                members: members
            }

            if (match[3]) {
                const varList = match[3]
                const individualVars = varList.split(/\s*,\s*/)
                structDefs[structName].instanceVars = []
                for (const varName of individualVars) {
                    const trimmedVarName = varName.trim()
                    if (trimmedVarName) {
                        structDefs[structName].instanceVars.push(trimmedVarName)
                    }
                }
            }
        }

        return structDefs
    }

    private parseStructMembers(membersStr: string): any[] {
        const members: any[] = []
        const lines = membersStr.split(';')

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            const memberRegex = /\b([a-zA-Z_]\w*(?:\s*[*&])?\s*(?:<[^>]*>)?)\s+([a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*=\s*[^,;]+)?(?:\s*,\s*[a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*=\s*[^,;]+)?)*)/g
            let memberMatch: RegExpExecArray | null

            while ((memberMatch = memberRegex.exec(trimmed)) !== null) {
                const memberType = memberMatch[1].trim()
                const memberNamesStr = memberMatch[2]

                const memberNamesList = memberNamesStr.split(',')

                for (const memberNameWithInit of memberNamesList) {
                    const memberNameMatch = memberNameWithInit.trim().match(/^([a-zA-Z_]\w*)(?:\s*\[\s*\d+\s*\])?(?:\s*=\s*[^,;]+)?/)
                    if (!memberNameMatch) continue

                    const memberName = memberNameMatch[1]

                    if (['public', 'private', 'protected', 'static', 'const', 'virtual'].includes(memberName)) {
                        continue
                    }

                    members.push({
                        name: memberName,
                        type: memberType,
                        isFunction: false
                    })
                }
            }

            const funcRegex = /\b([a-zA-Z_]\w*(?:\s*[*&])?\s*(?:<[^>]*>)?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*(?:const\s*)?(?:=\s*0)?\s*;?/g
            let funcMatch: RegExpExecArray | null

            while ((funcMatch = funcRegex.exec(trimmed)) !== null) {
                const returnType = funcMatch[1].trim()
                const funcName = funcMatch[2]
                const params = funcMatch[3].trim()

                if (['public', 'private', 'protected', 'static', 'const', 'virtual', 'explicit', 'friend'].includes(funcName)) {
                    continue
                }

                members.push({
                    name: funcName,
                    type: returnType,
                    isFunction: true,
                    params: params
                })
            }
        }

        return members
    }

    private inferVariableTypes(code: string, structDefs: Record<string, any>): Record<string, any> {
        const varTypes: Record<string, any> = {}

        for (const structName in structDefs) {
            const structDef = structDefs[structName]

            if (structDef.instanceVars) {
                for (const varName of structDef.instanceVars) {
                    varTypes[varName] = {
                        type: structName,
                        isStruct: true,
                        isPointer: false,
                        isArray: false
                    }
                }
            }

            const declRegex = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+([a-zA-Z_]\\w*(?:\\s*\\[\\s*\\d+\\s*\\])?(?:\\s*,\\s*[a-zA-Z_]\\w*(?:\\s*\\[\\s*\\d+\\s*\\])?)*)`, 'g')
            let match: RegExpExecArray | null
            while ((match = declRegex.exec(code)) !== null) {
                const varList = match[1]
                const individualVars = varList.split(/\s*,\s*/)
                for (const varNameWithArray of individualVars) {
                    const arrayMatch = varNameWithArray.trim().match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/)
                    const varName = arrayMatch ? arrayMatch[1] : varNameWithArray.trim()
                    if (varName) {
                        varTypes[varName] = {
                            type: structName,
                            isStruct: true,
                            isPointer: false,
                            isArray: !!arrayMatch
                        }
                    }
                }
            }

            const ptrDeclRegex = new RegExp(`\\b(?:struct\\s+)?${structName}\\s*\\*\\s*([a-zA-Z_]\\w*(?:\\s*,\\s*[a-zA-Z_]\\w*)*)`, 'g')
            while ((match = ptrDeclRegex.exec(code)) !== null) {
                const varList = match[1]
                const individualVars = varList.split(/\s*,\s*/)
                for (const varName of individualVars) {
                    const trimmedVarName = varName.trim()
                    if (trimmedVarName) {
                        varTypes[trimmedVarName] = {
                            type: structName,
                            isStruct: true,
                            isPointer: true,
                            isArray: false
                        }
                    }
                }
            }
        }

        return varTypes
    }

    private extractIdentifiersFromCode(): string[] {
        const identifiers: string[] = []
        const code = this.globalText

        const varDeclarationRegex = /\b(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g
        let match: RegExpExecArray | null

        while ((match = varDeclarationRegex.exec(code)) !== null) {
            const varList = match[2]
            const individualVars = varList.split(/\s*,\s*/)

            for (const varName of individualVars) {
                const trimmedVarName = varName.trim()
                if (trimmedVarName) {
                    identifiers.push(trimmedVarName)
                }
            }
        }

        const functionRegex = /\b([\w_:*&:<>]+)\s+([a-zA-Z_]\w*)\s*\([^)]*\)\s*[{;]/g
        while ((match = functionRegex.exec(code)) !== null) {
            const functionName = match[2]
            if (functionName) {
                identifiers.push(functionName)
            }
        }

        return identifiers
    }

    private showSuggestions(suggestions: string[]): void {
        this.currentSuggestions = suggestions

        if (!this.suggestionsContainer) return
        this.suggestionsContainer.innerHTML = ''

        if (suggestions.length > 0) {
            const suggestionsWrapper = document.createElement('div')
            suggestionsWrapper.className = 'mobile-autocomplete-suggestions-wrapper'
            suggestionsWrapper.style.cssText = 'display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; white-space: nowrap; height: 100%; scrollbar-width: none; -ms-overflow-style: none;'

            ;(suggestionsWrapper as any).style.msOverflowStyle = 'none'
            suggestionsWrapper.style.scrollbarWidth = 'none'

            suggestions.forEach((suggestion, index) => {
                const suggestionElement = document.createElement('span')
                suggestionElement.className = 'mobile-autocomplete-item'
                suggestionElement.style.touchAction = 'manipulation'
                suggestionElement.textContent = suggestion

                suggestionElement.addEventListener('click', (e) => {
                    e.stopPropagation()
                    this.handleSuggestionClick(suggestion)
                })
                suggestionElement.addEventListener('touchend', (e) => {
                    e.preventDefault()
                    this.handleSuggestionClick(suggestion)
                })

                if (index < suggestions.length - 1) {
                    suggestionsWrapper.appendChild(suggestionElement)

                    const spacer = document.createElement('span')
                    spacer.innerHTML = '&nbsp;&nbsp;'
                    suggestionsWrapper.appendChild(spacer)
                } else {
                    suggestionsWrapper.appendChild(suggestionElement)
                }
            })

            const leftScrollBtn = document.createElement('span')
            leftScrollBtn.className = 'mobile-autocomplete-scroll-btn'
            leftScrollBtn.innerHTML = '\u2190'
            leftScrollBtn.style.cssText = 'margin: 0 5px; cursor: pointer; user-select: none; color: #888; font-weight: bold;'
            leftScrollBtn.addEventListener('click', () => {
                this.scrollSuggestions(-100)
            })

            const rightScrollBtn = document.createElement('span')
            rightScrollBtn.className = 'mobile-autocomplete-scroll-btn'
            rightScrollBtn.innerHTML = '\u2192'
            rightScrollBtn.style.cssText = 'margin: 0 5px; cursor: pointer; user-select: none; color: #888; font-weight: bold;'
            rightScrollBtn.addEventListener('click', () => {
                this.scrollSuggestions(100)
            })

            this.suggestionsContainer.appendChild(leftScrollBtn)
            this.suggestionsContainer.appendChild(suggestionsWrapper)
            this.suggestionsContainer.appendChild(rightScrollBtn)

            setTimeout(() => {
                this.updateScrollButtonsVisibility(suggestionsWrapper, leftScrollBtn, rightScrollBtn)
            }, 0)
        } else {
            this.suggestionsContainer.style.height = '40px'
        }

        this.currentSuggestions = suggestions
    }

    private scrollSuggestions(offset: number): void {
        const suggestionsWrapper = this.suggestionsContainer!.querySelector('.mobile-autocomplete-suggestions-wrapper') as HTMLElement | null
        if (suggestionsWrapper) {
            suggestionsWrapper.scrollBy({ left: offset, behavior: 'smooth' })

            setTimeout(() => {
                const leftScrollBtn = this.suggestionsContainer!.querySelector('.mobile-autocomplete-scroll-btn:first-child') as HTMLElement | null
                const rightScrollBtn = this.suggestionsContainer!.querySelector('.mobile-autocomplete-scroll-btn:last-child') as HTMLElement | null
                if (leftScrollBtn && rightScrollBtn) {
                    this.updateScrollButtonsVisibility(suggestionsWrapper, leftScrollBtn, rightScrollBtn)
                }
            }, 300)
        }
    }

    private updateScrollButtonsVisibility(suggestionsWrapper: HTMLElement, leftBtn: HTMLElement, rightBtn: HTMLElement): void {
        if (suggestionsWrapper && leftBtn && rightBtn) {
            if (suggestionsWrapper.scrollLeft > 0) {
                leftBtn.style.visibility = 'visible'
                leftBtn.style.opacity = '1'
            } else {
                leftBtn.style.visibility = 'hidden'
                leftBtn.style.opacity = '0'
            }

            const maxScroll = suggestionsWrapper.scrollWidth - suggestionsWrapper.clientWidth
            if (suggestionsWrapper.scrollLeft < maxScroll) {
                rightBtn.style.visibility = 'visible'
                rightBtn.style.opacity = '1'
            } else {
                rightBtn.style.visibility = 'hidden'
                rightBtn.style.opacity = '0'
            }
        }
    }

    private handleSuggestionClick(suggestion: string): void {
        const lastWordMatch = this.globalText.substring(0, this.globalCursorPos).match(/[\w]+$/)
        const prefix = lastWordMatch ? lastWordMatch[0] : ''

        if (typeof HabitTracker !== 'undefined' && HabitTracker.recordSelection) {
            HabitTracker.recordSelection(suggestion, prefix, 'mobile_click')
        }

        const textBeforeCursor = this.globalText.substring(0, this.globalCursorPos)
        const textAfterCursor = this.globalText.substring(this.globalCursorPos)

        let newText = this.globalText
        let newCursorPos = this.globalCursorPos

        const includeMatch = textBeforeCursor.match(/(#include\s*<?)[^<>\s]*$/)
        const preprocessorMatch = textBeforeCursor.match(/(#)[\w]*$/)

        if (includeMatch) {
            const prefix = includeMatch[1]
            const wordStartPos = this.globalCursorPos - includeMatch[0].length

            newText = this.globalText.substring(0, wordStartPos) +
                     prefix + suggestion +
                     textAfterCursor

            newCursorPos = wordStartPos + prefix.length + suggestion.length
        } else if (textBeforeCursor.endsWith('#include')) {
            const prefix = '#include '
            const wordStartPos = this.globalCursorPos - '#include'.length

            newText = this.globalText.substring(0, wordStartPos) +
                     prefix + suggestion +
                     textAfterCursor

            newCursorPos = wordStartPos + prefix.length + suggestion.length
        } else if (preprocessorMatch) {
            const prefix = preprocessorMatch[1]
            const wordStartPos = this.globalCursorPos - preprocessorMatch[0].length

            newText = this.globalText.substring(0, wordStartPos) +
                     prefix + suggestion +
                     textAfterCursor

            newCursorPos = wordStartPos + prefix.length + suggestion.length
        } else {
            const lastWordMatch = textBeforeCursor.match(/[\w]+$/)

            if (lastWordMatch) {
                const lastWord = lastWordMatch[0]
                const wordStartPos = this.globalCursorPos - lastWord.length

                newText = this.globalText.substring(0, wordStartPos) +
                         suggestion +
                         textAfterCursor

                newCursorPos = wordStartPos + suggestion.length
            } else {
                newText = textBeforeCursor + suggestion + textAfterCursor
                newCursorPos = this.globalCursorPos + suggestion.length
            }
        }

        globalText = newText
        globalCursorPos = newCursorPos

        this.globalText = newText
        this.globalCursorPos = newCursorPos

        if (typeof window.renderThreeLines === 'function') {
            window.renderThreeLines()
        }

        this.updateEditorDisplay()

        this.showSuggestions([])

        setTimeout(() => {
            if (typeof window.syncState === 'function') {
                window.syncState()
            }
        }, 10)
    }

    private updateEditorDisplay(): void {
        const currentText = typeof globalText !== 'undefined' ? globalText : this.globalText
        const currentCursorPos = typeof globalCursorPos !== 'undefined' ? globalCursorPos : this.globalCursorPos

        if (window.monacoEditor) {
            window.isUpdatingProgrammatically = true
            window.monacoEditor.setValue(currentText)
            if (typeof currentCursorPos !== 'undefined') {
                const position = window.monacoEditor.getModel().getPositionAt(currentCursorPos)
                window.monacoEditor.setPosition(position)
            }
        }

        const fullEditor = document.getElementById('full-editor') as HTMLTextAreaElement | null
        if (fullEditor) {
            fullEditor.value = currentText
            fullEditor.setSelectionRange(currentCursorPos, currentCursorPos)
        }

        if (window.isFullMode === false && typeof window.renderThreeLines === 'function') {
            window.renderThreeLines()
        }

        window.dispatchEvent(new CustomEvent('codeUpdated'))

        setTimeout(() => {
            if (window.isFullMode === false && typeof window.renderThreeLines === 'function') {
                window.renderThreeLines()
            }

            const container = document.getElementById('lines-container')
            if (container) {
                container.style.display = 'none'
                setTimeout(() => {
                    container.style.display = 'flex'
                }, 10)
            }
        }, 0)
    }

    getCurrentContent(): { text: string; cursorPos: number } {
        return {
            text: (typeof globalText !== 'undefined') ? globalText : this.globalText,
            cursorPos: (typeof globalCursorPos !== 'undefined') ? globalCursorPos : this.globalCursorPos
        }
    }

    getCurrentSuggestions(): string[] {
        return this.currentSuggestions
    }
}

export function initMobileAutocomplete(): void {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setupMobileAutocomplete())
    } else {
        setupMobileAutocomplete()
    }
}

function setupMobileAutocomplete(): void {
    const keyboardContainer = document.getElementById('keyboard-container')
    if (keyboardContainer) {
        const instance = new MobileAutocomplete(null, keyboardContainer)
        ;(window as any).mobileAutocomplete = instance
        ;(window as any).updateMobileAutocomplete = () => {
            if ((window as any).mobileAutocomplete) {
                (window as any).mobileAutocomplete.triggerUpdate()
            }
        }
    }
}

export { MobileAutocomplete }
