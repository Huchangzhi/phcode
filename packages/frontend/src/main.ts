import * as Theme from './theme'
import { LocalCompile } from './local-compile'
import CodeFeatures from './code-features'
import { PhoiDialog } from './dialog'
import { LightModel, createLightModel } from './light-model'
import { HabitTracker } from './habit-tracker'
import { registerCompletionProviders, sortSuggestionsByIntelligence, recordAndSortSuggestions, parseStructDefinitions, parseStructMembers, inferVariableTypes, getStructMembersForVariable, extractVariableNames, cppKeywords, stlContainers, cppFunctions, cppObjects, structDefinitions } from './autocomplete'
import { cphPlugin, handleCompetitiveCompanionData, startCompanionPolling } from './cph'
import { initMobileAutocomplete } from './mobile-autocomplete'
import { initLuoguFeature, getLuoguThemeColors, showLuoguProblemDialog, loadLuoguProblem, createProblemDisplayArea, displayLuoguProblem, renderMarkdownAndLatex, showMessage, transferProblemToCPH, createAndOpenCppFile } from './luogu'
import { vfsModule, initVFSModule, initializeVFS, saveVFS, renderVFS, openFile, deleteFile, toggleVFSPanel } from './vfs'
import { init as debugInit, startDebug, stopDebug, sendCommand, recreateBreakpointDecorations, debugState, refreshVariablesDisplay, refreshAllVariables, resetVariableState } from './debug'

declare global {
  interface Window {
    vfsModule: any
    vfsPanel: HTMLElement
    vfsCloseBtn: HTMLElement
    vfsContent: HTMLElement
    sidebarToggle: HTMLElement
    PhoiAPI: any
    isFullMode: boolean
    globalText: string
    globalCursorPos: number
    renderThreeLines: () => void
    syncState: () => void
    _enableCustomTouchScroll: (el: HTMLElement) => void
    monacoClangdLSP: any
    monacoEditor: any
    pako: any
    debugState: any
    refreshVariablesDisplay: () => void
    refreshAllVariables: () => void
    resetVariableState: () => void
    DebugModule: {
        init: () => void
        startDebug: (pairingCode?: string) => void
        stopDebug: () => void
        sendCommand: (cmd: string) => void
        recreateBreakpointDecorations: () => void
    }
    initializeMonacoClangdIntegration: () => Promise<void>
    updateClangdDownloadProgress: (status: string, progress: number, max: number, detailText?: string) => void
    LocalCompile: typeof LocalCompile
    CodeFeatures: typeof CodeFeatures
    LightModel: LightModel
    LightModelClass: typeof LightModel
    HabitTracker: typeof HabitTracker
    PhoiDialog: typeof PhoiDialog
    registerCompletionProviders: typeof registerCompletionProviders
    sortSuggestionsByIntelligence: typeof sortSuggestionsByIntelligence
    parseStructDefinitions: typeof parseStructDefinitions
    parseStructMembers: typeof parseStructMembers
    inferVariableTypes: typeof inferVariableTypes
    getStructMembersForVariable: typeof getStructMembersForVariable
    extractVariableNames: typeof extractVariableNames
    cphPlugin: typeof cphPlugin
    handleCompetitiveCompanionData: typeof handleCompetitiveCompanionData
    mobileAutocomplete: any
    updateMobileAutocomplete: () => void
    showTerminalPanel: any
    switchTerminalTab: any
    isUpdatingProgrammatically: boolean
    _splashReady: boolean
    _splashData: any

    // Luogu API (migrated from static/luogu.js)
    luoguThemeEnabled: boolean
    getLuoguThemeColors: typeof getLuoguThemeColors
    showLuoguProblemDialog: typeof showLuoguProblemDialog
    loadLuoguProblem: typeof loadLuoguProblem
    createProblemDisplayArea: typeof createProblemDisplayArea
    displayLuoguProblem: typeof displayLuoguProblem
    renderMarkdownAndLatex: typeof renderMarkdownAndLatex
    showMessage: typeof showMessage
    transferProblemToCPH: typeof transferProblemToCPH
    createAndOpenCppFile: typeof createAndOpenCppFile
    cppKeywords: string[]
    stlContainers: any
    cppFunctions: any
    cppObjects: any
    structDefinitions: any
    recordAndSortSuggestions: typeof recordAndSortSuggestions
    startDebug: () => void
    stopDebug: () => void
    sendCommand: (cmd: string) => void
    recreateBreakpointDecorations: () => void

    // Theme API (migrated from script.js)
    getActualTheme: typeof Theme.getActualTheme
    initTheme: typeof Theme.initTheme
    applyTheme: typeof Theme.applyTheme
    getSystemPreferredTheme: typeof Theme.getSystemPreferredTheme
    applySystemTheme: typeof Theme.applySystemTheme
    setupSystemThemeListener: typeof Theme.setupSystemThemeListener
    removeSystemThemeListener: typeof Theme.removeSystemThemeListener
    updateMonacoEditorTheme: typeof Theme.updateMonacoEditorTheme
    updateMonacoTheme: typeof Theme.updateMonacoTheme
    updateImagesForTheme: typeof Theme.updateImagesForTheme
    setTheme: typeof Theme.setTheme
  }
}

// Expose theme functions globally for inline HTML event handlers
Object.assign(window, Theme)

// Expose LocalCompile globally (replaces static/local_compile.js)
window.LocalCompile = LocalCompile

// Expose CodeFeatures globally (replaces static/code_features.js)
window.CodeFeatures = CodeFeatures

// Expose PhoiDialog globally (replaces static/dialog.js)
window.PhoiDialog = PhoiDialog

// Expose LightModel globally (replaces static/light_model.js)
const lightModelInstance = createLightModel()
window.LightModel = lightModelInstance
window.LightModelClass = LightModel

// Expose HabitTracker globally (replaces static/habit_tracker.js)
window.HabitTracker = HabitTracker

// Expose autocomplete functions globally (replaces static/autocomplete.js)
window.registerCompletionProviders = registerCompletionProviders
window.sortSuggestionsByIntelligence = sortSuggestionsByIntelligence
window.parseStructDefinitions = parseStructDefinitions
window.parseStructMembers = parseStructMembers
window.inferVariableTypes = inferVariableTypes
window.getStructMembersForVariable = getStructMembersForVariable
window.extractVariableNames = extractVariableNames
window.recordAndSortSuggestions = recordAndSortSuggestions
window.cppKeywords = cppKeywords
window.stlContainers = stlContainers
window.cppFunctions = cppFunctions
window.cppObjects = cppObjects
window.structDefinitions = structDefinitions

// Expose VFS globally (replaces static/vfs.js)
window.vfsModule = vfsModule

// Expose CPH globally (replaces static/cph.js)
window.cphPlugin = cphPlugin
window.handleCompetitiveCompanionData = handleCompetitiveCompanionData

// Start CPH companion polling
startCompanionPolling()

// Initialize mobile autocomplete (replaces static/mobile_autocomplete.js)
initMobileAutocomplete()

// Initialize luogu plugin (replaces static/luogu.js)
initLuoguFeature()

// Expose luogu functions globally
Object.assign(window, { getLuoguThemeColors, showLuoguProblemDialog, loadLuoguProblem, createProblemDisplayArea, displayLuoguProblem, renderMarkdownAndLatex, showMessage, transferProblemToCPH, createAndOpenCppFile })

// Expose debug functions globally
// Note: debug.js IIFE already calls init() internally — do NOT call debugInit() here
window.debugState = debugState
window.refreshVariablesDisplay = refreshVariablesDisplay
window.refreshAllVariables = refreshAllVariables
window.resetVariableState = resetVariableState
window.startDebug = startDebug
window.stopDebug = stopDebug
window.sendCommand = sendCommand
window.recreateBreakpointDecorations = recreateBreakpointDecorations
// DebugModule is set by debug.js <script> tag — do NOT overwrite here

// Init modules that require startup calls
Theme.initTheme()

// Set VFS panel DOM element globals (previously done by script.js, now dead code there)
window.vfsPanel = document.getElementById('vfs-panel') as HTMLElement
window.vfsCloseBtn = document.getElementById('vfs-close-btn') as HTMLElement
window.vfsContent = document.getElementById('vfs-content') as HTMLElement
window.sidebarToggle = document.getElementById('sidebar-toggle') as HTMLElement

initVFSModule().catch(err => console.error('VFS init failed:', err))
console.log('PH Code Editor v3 loaded')
