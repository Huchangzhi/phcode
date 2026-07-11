declare var globalText: string
declare var globalCursorPos: number
declare var HabitTracker: {
  sortSuggestions?: (suggestions: any[], prefix: string, text: string, cursorPos: number) => any[]
  recordSelection?: (suggestion: string, prefix: string, source: string) => void
}
