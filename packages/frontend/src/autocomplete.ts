const cppKeywords = [
    'if', 'else', 'switch', 'case', 'default', 'break', 'continue', 'goto',
    'while', 'do', 'for',
    'return', 'extern', 'inline',
    'void', 'bool', 'char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t', 'short', 'int', 'long', 'float', 'double',
    'signed', 'unsigned', 'typedef',
    'const', 'volatile', 'static', 'auto', 'register', 'mutable',
    'class', 'struct', 'union', 'enum', 'public', 'private', 'protected', 'friend', 'virtual', 'override', 'final',
    'this', 'explicit', 'constexpr', 'consteval', 'constinit',
    // Inheritance
    'public', 'private', 'protected', 'virtual', 'override',
    // Storage Classes
    'static', 'extern', 'register', 'mutable',
    'new', 'delete', 'sizeof', 'typeid', 'dynamic_cast', 'static_cast', 'reinterpret_cast', 'const_cast',
    'namespace', 'using',
    'template', 'typename', 'decltype', 'concept', 'requires',
    'try', 'catch', 'throw', 'noexcept',
    'true', 'false', 'nullptr', 'asm', 'thread_local', 'alignas', 'alignof'
]

function sortSuggestionsByIntelligence(suggestions: any[], prefix = '', code = '', cursorPos = 0): any[] {
    if (!suggestions || suggestions.length === 0) return suggestions
    if (typeof (window as any).HabitTracker !== 'undefined' && (window as any).HabitTracker.sortSuggestions) {
        return (window as any).HabitTracker.sortSuggestions(suggestions, prefix, code, cursorPos)
    }
    const priorityOrder: Record<string, number> = {
        'Field': 0, 3: 0,
        'Method': 1, 0: 1,
        'Variable': 2, 4: 2,
        'Struct': 3, 6: 3,
        'Class': 4, 5: 4,
        'Interface': 5, 7: 5,
        'Keyword': 10, 17: 10,
        'Snippet': 11, 18: 11,
        'Module': 20, 8: 20,
        'Property': 21, 9: 21,
        'Function': 22, 1: 22, 2: 22, 10: 22, 11: 22, 12: 22, 13: 22, 14: 22, 15: 22, 16: 22, 19: 22, 20: 22, 21: 22, 22: 22,
        23: 22, 24: 22, 25: 22, 100: 100
    }
    return suggestions.sort((a: any, b: any) => {
        let kindA = a.kind
        let kindB = b.kind
        const priorityA = priorityOrder[kindA] ?? priorityOrder[String(kindA)] ?? 100
        const priorityB = priorityOrder[kindB] ?? priorityOrder[String(kindB)] ?? 100
        if (priorityA !== priorityB) return priorityA - priorityB
        if (prefix) {
            const labelA = a.label.toLowerCase()
            const labelB = b.label.toLowerCase()
            const prefixLower = prefix.toLowerCase()
            const startsWithA = labelA.startsWith(prefixLower)
            const startsWithB = labelB.startsWith(prefixLower)
            if (startsWithA && !startsWithB) return -1
            if (!startsWithA && startsWithB) return 1
            return labelA.length - labelB.length
        }
        return a.label.localeCompare(b.label)
    })
}

function recordAndSortSuggestions(suggestions: any[], prefix = '', context = '', code = '', cursorPos = 0): any[] {
    if (typeof (window as any).HabitTracker !== 'undefined' && (window as any).HabitTracker.recordSelection) {
        const topSuggestions = suggestions.slice(0, 3)
        topSuggestions.forEach(s => {
            (window as any).HabitTracker.recordSelection(s.label, prefix, context)
        })
    }
    return sortSuggestionsByIntelligence(suggestions, prefix, code, cursorPos)
}

const stlContainers: Record<string, { functions: string[]; properties: string[] }> = {
    'vector': {
        functions: ['assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend', 'front', 'back', 'empty', 'size', 'max_size', 'reserve'],
        properties: ['data', 'get_allocator', 'capacity', 'shrink_to_fit', 'operator[]']
    },
    'queue': { functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'front', 'back'], properties: [] },
    'stack': { functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'top'], properties: [] },
    'set': {
        functions: ['find', 'count', 'lower_bound', 'upper_bound', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'multiset': {
        functions: ['find', 'count', 'lower_bound', 'upper_bound', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'map': {
        functions: ['at', 'insert', 'insert_or_assign', 'emplace', 'emplace_hint', 'try_emplace', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'lower_bound', 'upper_bound', 'equal_range', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend', 'empty', 'size', 'max_size', 'clear'],
        properties: ['operator[]', 'key_comp', 'value_comp', 'get_allocator']
    },
    'multimap': {
        functions: ['empty', 'size', 'max_size', 'clear', 'insert', 'emplace', 'emplace_hint', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'lower_bound', 'upper_bound', 'equal_range', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'unordered_set': {
        functions: ['find', 'count', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'insert_or_assign', 'try_emplace', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'cbegin', 'cend', 'empty', 'size', 'max_size'],
        properties: ['bucket_count', 'max_bucket_count', 'bucket_size', 'bucket', 'load_factor', 'max_load_factor', 'rehash', 'reserve', 'hash_function', 'key_eq', 'get_allocator', 'contains']
    },
    'unordered_map': {
        functions: ['at', 'insert', 'insert_or_assign', 'emplace', 'emplace_hint', 'try_emplace', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'equal_range', 'begin', 'end', 'cbegin', 'cend', 'empty', 'size', 'max_size', 'clear'],
        properties: ['operator[]', 'bucket_count', 'max_bucket_count', 'bucket_size', 'bucket', 'load_factor', 'max_load_factor', 'rehash', 'reserve', 'hash_function', 'key_eq', 'get_allocator']
    },
    'priority_queue': { functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'top'], properties: [] },
    'deque': {
        functions: ['front', 'back', 'assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size', 'push_front', 'pop_front'],
        properties: ['operator[]', 'get_allocator', 'shrink_to_fit']
    },
    'list': {
        functions: ['front', 'back', 'assign', 'insert', 'emplace', 'erase', 'push_front', 'emplace_front', 'pop_front', 'resize', 'swap', 'merge', 'splice', 'remove', 'remove_if', 'reverse', 'unique', 'sort', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['get_allocator']
    },
    'array': {
        functions: ['at', 'swap', 'fill', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend', 'front', 'back', 'empty', 'size', 'max_size'],
        properties: ['operator[]', 'data']
    },
    'pair': { functions: [], properties: ['first', 'second'] }
}

const cppFunctions: Record<string, string[]> = {
    'cstdio': ['printf', 'scanf', 'fprintf', 'fscanf', 'sscanf', 'sprintf', 'snprintf', 'getchar', 'putchar', 'gets', 'puts', 'fgets', 'fputs', 'fclose', 'fflush'],
    'cstdlib': ['malloc', 'calloc', 'realloc', 'free', 'abs', 'labs', 'llabs', 'atoi', 'atol', 'atoll', 'atof', 'rand', 'srand', 'qsort', 'bsearch'],
    'cstring': [        'memcpy', 'memset', 'strcpy', 'strncpy', 'strcat', 'strncat', 'memcmp', 'strcmp', 'strncmp', 'strlen', 'strchr', 'strstr'],
    'utility': ['pair', 'make_pair', 'swap', 'forward', 'move'],
    'algorithm': ['sort', 'reverse', 'lower_bound', 'upper_bound', 'find', 'count', 'max', 'min', 'max_element', 'min_element', 'unique', 'remove', 'fill', 'next_permutation', 'prev_permutation'],
    'memory': ['make_unique', 'make_shared', 'unique_ptr', 'shared_ptr', 'weak_ptr'],
    'cmath': ['min', 'max', 'sqrt', 'pow'],
}

const cppObjects: Record<string, string[]> = {
    'iostream': ['cin', 'cout', 'cerr', 'clog', 'endl', 'ws', 'flush'],
    'iomanip': ['setw', 'setprecision', 'setfill', 'setbase', 'hex', 'dec', 'oct', 'fixed', 'scientific'],
    'queue': [],
    'vector': [],
    'set': [],
    'map': [],
    'deque': [],
    'stack': [],
    'bits/stdc++.h': [],
}

interface StructMember {
    name: string
    type: string
    isFunction: boolean
    params?: string
}

interface StructDef {
    name: string
    members: StructMember[]
    startPos: number
    endPos: number
    instanceVars: string[]
    pointerVars: string[]
}

interface VarInfo {
    type: string
    isStruct: boolean
    isPointer: boolean
    isArray: boolean
}

const structDefinitions: Record<string, StructDef> = {}

function parseStructDefinitions(code: string): Record<string, StructDef> {
    const structDefs: Record<string, StructDef> = {}
    const structRegex = /\bstruct\s+([a-zA-Z_]\w*)\s*\{([^}]*)\}\s*([a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*,\s*(?:[*&]\s*)?[a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?)*)?\s*;/g
    let match
    while ((match = structRegex.exec(code)) !== null) {
        const structName = match[1]
        const membersStr = match[2]
        const members = parseStructMembers(membersStr)
        structDefs[structName] = {
            name: structName,
            members,
            startPos: match.index,
            endPos: match.index + match[0].length,
            instanceVars: [],
            pointerVars: []
        }
        if (match[3]) {
            const varList = match[3]
            const individualVars = varList.split(/\s*,\s*/)
            for (const varNameWithArray of individualVars) {
                const trimmed = varNameWithArray.trim()
                const ptrMatch = trimmed.match(/^\s*[*&]\s*([a-zA-Z_]\w*)/)
                if (ptrMatch) {
                    structDefs[structName].pointerVars.push(ptrMatch[1])
                } else {
                    const arrayMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/)
                    const varName = arrayMatch ? arrayMatch[1] : trimmed
                    if (varName && /^[a-zA-Z_]\w*$/.test(varName)) {
                        structDefs[structName].instanceVars.push(varName)
                    }
                }
            }
        }
    }
    return structDefs
}

function parseStructMembers(membersStr: string): StructMember[] {
    const members: StructMember[] = []
    const lines = membersStr.split(';')
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const typeMatch = trimmed.match(/^([a-zA-Z_]\w*)/)
        if (!typeMatch) continue
        const baseType = typeMatch[1]
        let rest = trimmed.slice(typeMatch[0].length).trim()
        const parts = rest.split(',')
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i].trim()
            if (!p) continue
            const nameMatch = p.match(/^([*&]?\s*[a-zA-Z_]\w*)/)
            if (!nameMatch) continue
            let memberName = nameMatch[1].trim()
            let memberType: string = baseType
            if (memberName.startsWith('*')) {
                memberType = baseType + '*'
                memberName = memberName.replace(/^\*+/, '').trim()
            } else if (memberName.startsWith('&')) {
                memberType = baseType + '&'
                memberName = memberName.replace(/^&+/, '').trim()
            }
            const arrayMatch = memberName.match(/^([a-zA-Z_]\w*)/)
            if (arrayMatch) memberName = arrayMatch[1]
            if (['public', 'private', 'protected', 'static', 'const', 'virtual'].includes(memberName)) continue
            members.push({ name: memberName, type: memberType, isFunction: false })
        }
        const funcRegex = /\b([a-zA-Z_]\w*(?:\s*[*&])?\s*(?:<[^>]*>)?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*(?:const\s*)?(?:=\s*0)?\s*;?/g
        let funcMatch
        while ((funcMatch = funcRegex.exec(trimmed)) !== null) {
            const funcName = funcMatch[2]
            const returnType = funcMatch[1].trim()
            const params = funcMatch[3].trim()
            if (['public', 'private', 'protected', 'static', 'const', 'virtual', 'explicit', 'friend'].includes(funcName)) continue
            members.push({ name: funcName, type: returnType, isFunction: true, params })
        }
    }
    return members
}

function inferVariableTypes(code: string, structDefs: Record<string, StructDef>): Record<string, VarInfo> {
    const varTypes: Record<string, VarInfo> = {}
    let match
    for (const structName in structDefs) {
        const structDef = structDefs[structName]
        if (structDef.instanceVars && structDef.instanceVars.length > 0) {
            for (const varName of structDef.instanceVars) {
                varTypes[varName] = { type: structName, isStruct: true, isPointer: false, isArray: true }
            }
        }
        if (structDef.pointerVars && structDef.pointerVars.length > 0) {
            for (const varName of structDef.pointerVars) {
                varTypes[varName] = { type: structName, isStruct: true, isPointer: true, isArray: false }
            }
        }
        const declRegex = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+([a-zA-Z_]\\w*(?:\\s*\\[\\s*\\d+\\s*\\])?(?:\\s*,\\s*[a-zA-Z_]\\w*(?:\\s*\\[\\s*\\d+\\s*\\])?)*)`, 'g')
        while ((match = declRegex.exec(code)) !== null) {
            const varList = match[1]
            const individualVars = varList.split(/\s*,\s*/)
            for (const varNameWithArray of individualVars) {
                const arrayMatch = varNameWithArray.trim().match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/)
                const varName = arrayMatch ? arrayMatch[1] : varNameWithArray.trim()
                if (varName) varTypes[varName] = { type: structName, isStruct: true, isPointer: false, isArray: !!arrayMatch }
            }
        }
        const ptrDeclRegex1 = new RegExp(`\\b(?:struct\\s+)?${structName}\\s*\\*\\s*([a-zA-Z_]\\w*(?:\\s*,\\s*[a-zA-Z_]\\w*)*)`, 'g')
        while ((match = ptrDeclRegex1.exec(code)) !== null) {
            const varList = match[1]
            const individualVars = varList.split(/\s*,\s*/)
            for (const varName of individualVars) {
                const trimmedVarName = varName.trim()
                if (trimmedVarName) varTypes[trimmedVarName] = { type: structName, isStruct: true, isPointer: true, isArray: false }
            }
        }
        const ptrDeclRegex2 = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+\\*([a-zA-Z_]\\w*(?:\\s*,\\s*\\*[a-zA-Z_]\\w*)*)`, 'g')
        while ((match = ptrDeclRegex2.exec(code)) !== null) {
            const varList = match[1]
            const individualVars = varList.split(/\s*,\s*\*/)
            for (let i = 0; i < individualVars.length; i++) {
                const trimmedVarName = individualVars[i].trim()
                if (trimmedVarName && /^[a-zA-Z_]\w*$/.test(trimmedVarName)) {
                    varTypes[trimmedVarName] = { type: structName, isStruct: true, isPointer: true, isArray: false }
                }
            }
        }
    }
    const varDeclarationRegex = /\b(?!struct\b)(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*,\s*[a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?)*)/g
    while ((match = varDeclarationRegex.exec(code)) !== null) {
        const varType = match[1]
        const varList = match[2]
        const individualVars = varList.split(/\s*,\s*/)
        for (const varNameWithArray of individualVars) {
            const trimmedVarName = varNameWithArray.trim()
            const arrayMatch = trimmedVarName.match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/)
            const varName = arrayMatch ? arrayMatch[1] : trimmedVarName
            if (varName && !varTypes[varName]) {
                varTypes[varName] = { type: varType, isStruct: structDefs.hasOwnProperty(varType), isPointer: false, isArray: !!arrayMatch }
            }
        }
    }
    const functionRegex = /\b(?:[a-zA-Z_*&:<>]+\s+)+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)\s*(?:const\s+)?(?:\[[^\]]*\]\s*)*(?:noexcept\s*\(.*\)\s*)*(?:->\s*[\w_*:<>]+)?\s*{/gi
    let functionMatch
    while ((functionMatch = functionRegex.exec(code)) !== null) {
        const paramsStr = functionMatch[1]
        if (paramsStr.trim()) {
            const params = paramsStr.split(',')
            for (const param of params) {
                const varMatches = param.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
                if (varMatches) {
                    const varName = varMatches[varMatches.length - 1]
                    if (varName && !varTypes[varName]) {
                        const typeMatch = param.match(/\b([\w:*&<>]+)\s+/)
                        const paramType = typeMatch ? typeMatch[1].trim() : 'unknown'
                        varTypes[varName] = { type: paramType, isStruct: structDefs.hasOwnProperty(paramType.replace(/[*&]/g, '')), isPointer: paramType.includes('*'), isArray: false }
                    }
                }
            }
        }
    }
    return varTypes
}

function getStructMembersForVariable(varName: string, code: string, structDefs: Record<string, StructDef>, varTypes: Record<string, VarInfo>): { structName: string; members: StructMember[]; isPointer: boolean; isArray: boolean } | null {
    if (Object.keys(varTypes).length === 0) {
        varTypes = inferVariableTypes(code, structDefs)
    }
    const varInfo = varTypes[varName]
    if (!varInfo || !varInfo.isStruct) return null
    const structName = varInfo.type
    const structDef = structDefs[structName]
    if (!structDef) return null
    return { structName, members: structDef.members, isPointer: varInfo.isPointer, isArray: varInfo.isArray }
}

function extractVariableNames(code: string): string[] {
    const variables = new Set<string>()
    let match
    const structDefs = parseStructDefinitions(code)
    const varDeclarationRegex = /\b(?!struct\b)(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g
    while ((match = varDeclarationRegex.exec(code)) !== null) {
        const varList = match[2]
        const individualVars = varList.split(/\s*,\s*/)
        for (const varName of individualVars) {
            const trimmedVarName = varName.trim()
            if (trimmedVarName) variables.add(trimmedVarName)
        }
    }
    const functionRegex = /\b(?:[a-zA-Z_*&:<>]+\s+)+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)\s*(?:const\s+)?(?:\[[^\]]*\]\s*)*(?:noexcept\s*\(.*\)\s*)*(?:->\s*[\w_*:<>]+)?\s*{/gi
    let functionMatch
    while ((functionMatch = functionRegex.exec(code)) !== null) {
        const paramsStr = functionMatch[1]
        if (paramsStr.trim()) {
            const params = paramsStr.split(',')
            for (const param of params) {
                const varMatches = param.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
                if (varMatches) {
                    const varName = varMatches[varMatches.length - 1]
                    if (varName) variables.add(varName)
                }
            }
        }
    }
    const pairDeclarationRegex = /pair\s*<\s*[\w:<> ]+\s*,\s*[\w:<> ]+\s*>\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g
    while ((match = pairDeclarationRegex.exec(code)) !== null) {
        const varList = match[1]
        const individualVars = varList.split(/\s*,\s*/)
        for (const varName of individualVars) {
            const trimmedVarName = varName.trim()
            if (trimmedVarName) variables.add(trimmedVarName)
        }
    }
    for (const structName in structDefs) {
        const structDeclRegex = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+([a-zA-Z_]\\w*(?:\\s*,\\s*[a-zA-Z_]\\w*)*)`, 'g')
        while ((match = structDeclRegex.exec(code)) !== null) {
            const varList = match[1]
            const individualVars = varList.split(/\s*,\s*/)
            for (const varName of individualVars) {
                const trimmedVarName = varName.trim()
                if (trimmedVarName) variables.add(trimmedVarName)
            }
        }
    }
    const assignmentRegex = /\b([a-zA-Z_]\w*)\s*=[^=]/g
    while ((match = assignmentRegex.exec(code)) !== null) {
        variables.add(match[1])
    }
    const functionCallRegex = /\b([a-zA-Z_]\w*)\s*\.\s*\w+/g
    while ((match = functionCallRegex.exec(code)) !== null) {
        variables.add(match[1])
    }
    const arrayAccessRegex = /\b([a-zA-Z_]\w*)\s*\[/g
    while ((match = arrayAccessRegex.exec(code)) !== null) {
        variables.add(match[1])
    }
    return Array.from(variables)
}

function registerCompletionProviders(): void {
    const monaco = (window as any).monaco
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function (model: any, position: any) {
            const word = model.getWordUntilPosition(position)
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            }
            const prefix = word.word
            const currentLine = model.getLineContent(position.lineNumber)
            const textBefore = currentLine.substring(0, position.column - 1)
            const fullText = model.getValue()
            const cursorPos = model.getOffsetAt(position)
            const allSuggestions: any[] = []
            const addedLabels = new Set<string>()
            function addSuggestion(label: string, item: any) {
                if (!addedLabels.has(label)) {
                    addedLabels.add(label)
                    allSuggestions.push(item)
                }
            }
            if (textBefore.trim().endsWith('#include <') || /.*#include\s*<[^>]*$/.test(textBefore)) {
                const allHeaders = new Set([...Object.keys(cppFunctions), ...Object.keys(cppObjects)])
                for (const headerName of allHeaders) {
                    allSuggestions.push({
                        label: headerName,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `${headerName}>`,
                        detail: `C++ standard library header`,
                        documentation: `Standard library header: ${headerName}`,
                        range
                    })
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
            }
            if (textBefore.trim() === '#' || textBefore.trim().endsWith('#')) {
                const directives = ['include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma']
                for (const dir of directives) {
                    allSuggestions.push({
                        label: dir,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: dir,
                        detail: 'C++ preprocessor directive',
                        documentation: `C++ preprocessor directive: ${dir}`,
                        range
                    })
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
            }
            if (textBefore.endsWith('.')) {
                const beforeDot = textBefore.substring(0, textBefore.lastIndexOf('.')).trim()
                let potentialContainerName = ''
                const arrayMatch = beforeDot.match(/([a-zA-Z_]\w*)\s*\[\s*[^\]]+\s*\]\s*$/)
                if (arrayMatch) {
                    potentialContainerName = arrayMatch[1]
                } else {
                    const parts = beforeDot.split(/[^\w\d_]/)
                    potentialContainerName = parts[parts.length - 1]
                }
                const arrowDotMatch = potentialContainerName.match(/^(.*)->$/)
                if (arrowDotMatch) potentialContainerName = arrowDotMatch[1].trim()
                const currentStructDefs = parseStructDefinitions(fullText)
                const currentVarTypes = inferVariableTypes(fullText, currentStructDefs)
                let foundStructMembers = false
                if (potentialContainerName && currentVarTypes[potentialContainerName]) {
                    const varInfo = currentVarTypes[potentialContainerName]
                    if (varInfo.isStruct) {
                        const structDef = currentStructDefs[varInfo.type]
                        if (structDef) {
                            for (const member of structDef.members) {
                                if (member.isFunction) {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Method,
                                        insertText: member.name + '($1)',
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        detail: `${member.type} ${member.name}(${member.params || ''})`,
                                        documentation: `Member function of struct ${structDef.name}`,
                                        range
                                    })
                                } else {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Field,
                                        insertText: member.name,
                                        detail: `${member.type} ${member.name}`,
                                        documentation: `Member variable of struct ${structDef.name}`,
                                        range
                                    })
                                }
                            }
                            foundStructMembers = allSuggestions.length > 0
                        }
                    }
                }
                if (foundStructMembers) {
                    return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
                }
                const usedContainers = new Set<string>()
                for (const containerName in stlContainers) {
                    const regex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+[a-zA-Z_][a-zA-Z0-9_]*`, 'g')
                    if (regex.test(fullText)) {
                        usedContainers.add(containerName)
                    }
                }
                let specificContainer: string | null = null
                if (potentialContainerName) {
                    for (const containerName of usedContainers) {
                        const declRegex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*)*${potentialContainerName}\\b`)
                        if (declRegex.test(fullText)) {
                            specificContainer = containerName
                            break
                        }
                    }
                }
                const containersToSuggest = specificContainer ? [specificContainer] : Array.from(usedContainers)
                for (const containerName of containersToSuggest) {
                    if (stlContainers[containerName]) {
                        if (stlContainers[containerName].functions) {
                            stlContainers[containerName].functions.forEach((method: string) => {
                                allSuggestions.push({
                                    label: method,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: method + '($1)',
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: `${containerName}::${method}()`,
                                    documentation: `STL ${containerName} container method`,
                                    range
                                })
                            })
                        }
                        if (stlContainers[containerName].properties) {
                            stlContainers[containerName].properties.forEach((property: string) => {
                                allSuggestions.push({
                                    label: property,
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    insertText: property,
                                    detail: `${containerName}::${property}`,
                                    documentation: `STL ${containerName} container property`,
                                    range
                                })
                            })
                        }
                    }
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
            }
            if (textBefore.endsWith('->')) {
                const beforeArrow = textBefore.substring(0, textBefore.length - 2).trim()
                if (!beforeArrow) {
                    return { suggestions: [] }
                }
                let potentialContainerName = ''
                const arrayMatch = beforeArrow.match(/([a-zA-Z_]\w*)\s*\[\s*[^\]]+\s*\]\s*$/)
                if (arrayMatch) {
                    potentialContainerName = arrayMatch[1]
                } else {
                    const parts = beforeArrow.split(/[^\w\d_]/)
                    potentialContainerName = parts[parts.length - 1]
                }
                if (!potentialContainerName) {
                    return { suggestions: [] }
                }
                const currentStructDefs = parseStructDefinitions(fullText)
                const currentVarTypes = inferVariableTypes(fullText, currentStructDefs)
                let foundStructMembers = false
                if (potentialContainerName && currentVarTypes[potentialContainerName]) {
                    const varInfo = currentVarTypes[potentialContainerName]
                    if (varInfo.isStruct) {
                        const structDef = currentStructDefs[varInfo.type]
                        if (structDef) {
                            for (const member of structDef.members) {
                                if (member.isFunction) {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Method,
                                        insertText: member.name + '($1)',
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        detail: `${member.type} ${member.name}(${member.params || ''})`,
                                        documentation: `Member function of struct ${structDef.name}`,
                                        range
                                    })
                                } else {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Field,
                                        insertText: member.name,
                                        detail: `${member.type} ${member.name}`,
                                        documentation: `Member variable of struct ${structDef.name}`,
                                        range
                                    })
                                }
                            }
                            foundStructMembers = allSuggestions.length > 0
                        }
                    }
                }
                if (foundStructMembers) {
                    return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
                }
                const usedContainers = new Set<string>()
                for (const containerName in stlContainers) {
                    const regex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+[a-zA-Z_][a-zA-Z0-9_]*`, 'g')
                    if (regex.test(fullText)) {
                        usedContainers.add(containerName)
                    }
                }
                let specificContainer: string | null = null
                if (potentialContainerName) {
                    for (const containerName of usedContainers) {
                        const declRegex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*)*${potentialContainerName}\\b`)
                        if (declRegex.test(fullText)) {
                            specificContainer = containerName
                            break
                        }
                    }
                }
                const containersToSuggest = specificContainer ? [specificContainer] : Array.from(usedContainers)
                for (const containerName of containersToSuggest) {
                    if (stlContainers[containerName]) {
                        if (stlContainers[containerName].functions) {
                            stlContainers[containerName].functions.forEach((method: string) => {
                                allSuggestions.push({
                                    label: method,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: method + '($1)',
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: `${containerName}::${method}()`,
                                    documentation: `STL ${containerName} container method`,
                                    range
                                })
                            })
                        }
                        if (stlContainers[containerName].properties) {
                            stlContainers[containerName].properties.forEach((property: string) => {
                                allSuggestions.push({
                                    label: property,
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    insertText: property,
                                    detail: `${containerName}::${property}`,
                                    documentation: `STL ${containerName} container property`,
                                    range
                                })
                            })
                        }
                    }
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
            }
            for (const keyword of cppKeywords) {
                const isFunctionKeyword = ['main', 'printf', 'scanf', 'cin', 'cout'].includes(keyword)
                addSuggestion(keyword, {
                    label: keyword,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: isFunctionKeyword ? keyword + '($1)' : keyword,
                    insertTextRules: isFunctionKeyword ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range
                })
            }
            const variableNames = extractVariableNames(fullText)
            const currentStructDefs = parseStructDefinitions(fullText)
            const currentVarTypes = inferVariableTypes(fullText, currentStructDefs)
            for (const varName of variableNames) {
                const varInfo = currentVarTypes[varName]
                let kind = monaco.languages.CompletionItemKind.Variable
                let detail = 'Variable or function parameter'
                let documentation = 'Variable or function parameter defined in current code'
                if (varInfo && varInfo.isStruct) {
                    kind = monaco.languages.CompletionItemKind.Struct
                    detail = `struct ${varInfo.type}${varInfo.isPointer ? '*' : ''}`
                    documentation = `Struct variable of type ${varInfo.type}`
                } else if (new RegExp(`pair\\s*<[^>]*>\\s+${varName}\\b`).test(fullText)) {
                    kind = monaco.languages.CompletionItemKind.Struct
                    detail = 'pair variable'
                    documentation = 'STL pair variable'
                }
                addSuggestion(varName, {
                    label: varName,
                    kind: kind,
                    insertText: varName,
                    detail: detail,
                    documentation: documentation,
                    range
                })
            }
            for (const containerName in stlContainers) {
                addSuggestion(containerName, {
                    label: containerName,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: containerName,
                    detail: `STL ${containerName} container`,
                    documentation: `Standard Template Library ${containerName} container`,
                    range
                })
            }
            for (const structName in currentStructDefs) {
                addSuggestion(structName, {
                    label: structName,
                    kind: monaco.languages.CompletionItemKind.Struct,
                    insertText: structName,
                    detail: `struct ${structName}`,
                    documentation: `User-defined struct type`,
                    range
                })
            }
            for (const [headerName, functions] of Object.entries(cppFunctions)) {
                for (const func of functions) {
                    addSuggestion(func, {
                        label: func,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: func + '($1)',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: `${headerName}::${func}`,
                        documentation: `Function from ${headerName} header`,
                        range
                    })
                }
            }
            for (const [headerName, objects] of Object.entries(cppObjects)) {
                for (const obj of objects) {
                    const isFunctionLike = ['endl', 'flush', 'ws'].includes(obj)
                    addSuggestion(obj, {
                        label: obj,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        insertText: isFunctionLike ? obj + '($1)' : obj,
                        insertTextRules: isFunctionLike ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                        detail: `${headerName}::${obj}`,
                        documentation: `Object from ${headerName} header`,
                        range
                    })
                }
            }
            return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) }
        },
        triggerCharacters: ['.', '<', '#', '>', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '_', '/']
    })
}

const _window = window as any
_window.cppKeywords = cppKeywords
_window.stlContainers = stlContainers
_window.cppFunctions = cppFunctions
_window.cppObjects = cppObjects
_window.structDefinitions = structDefinitions
_window.sortSuggestionsByIntelligence = sortSuggestionsByIntelligence
_window.recordAndSortSuggestions = recordAndSortSuggestions
_window.parseStructDefinitions = parseStructDefinitions
_window.parseStructMembers = parseStructMembers
_window.inferVariableTypes = inferVariableTypes
_window.getStructMembersForVariable = getStructMembersForVariable
_window.extractVariableNames = extractVariableNames
_window.registerCompletionProviders = registerCompletionProviders

export {
    cppKeywords,
    stlContainers,
    cppFunctions,
    cppObjects,
    structDefinitions,
    sortSuggestionsByIntelligence,
    recordAndSortSuggestions,
    parseStructDefinitions,
    parseStructMembers,
    inferVariableTypes,
    getStructMembersForVariable,
    extractVariableNames,
    registerCompletionProviders
}
