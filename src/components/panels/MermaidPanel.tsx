import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { flowchartTags, foldByIndent, mermaid } from 'codemirror-lang-mermaid'
import { ChevronLeft, ChevronRight, FileCode2, Upload } from 'lucide-react'
import { defaultMermaid } from '../../lib/mermaid/defaultMermaid'

type MermaidDraft = {
  id: string
  name: string
  source: string
}

type MermaidPanelProps = {
  isCollapsed: boolean
  onToggle: () => void
  draft: MermaidDraft
  onDraftChange: (source: string) => void
  onImportDraft: () => void
  onClearDraft: () => void
  importError: string | null
}

const mermaidEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#FAFAFC',
    color: '#0F172A',
    fontSize: '11px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    height: '100%',
    lineHeight: '18px',
    overflow: 'auto',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '8px 10px',
  },
  '.cm-line': {
    padding: '0 2px',
  },
  '.cm-gutters': {
    backgroundColor: '#F8FAFC',
    borderRight: '1px solid #E7EAF0',
    color: '#64748B',
    fontSize: '10px',
  },
  '.cm-activeLine': {
    backgroundColor: '#F8F5FF',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#EEE9FF',
    color: '#6336F1',
  },
  '.cm-cursor': {
    borderLeftColor: '#6336F1',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#BFDBFE !important',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: '#EDE9FE',
    outline: '1px solid #C7B9FF',
  },
}, { dark: false })

const mermaidHighlightStyle = HighlightStyle.define([
  { tag: flowchartTags.diagramName, color: '#0F172A', fontWeight: '700' },
  { tag: flowchartTags.keyword, color: '#9D174D', fontWeight: '700' },
  { tag: flowchartTags.orientation, color: '#1D4ED8', fontWeight: '700' },
  { tag: flowchartTags.nodeId, color: '#1D4ED8', fontWeight: '700' },
  { tag: flowchartTags.nodeText, color: '#4F46E5', fontWeight: '600' },
  { tag: flowchartTags.link, color: '#64748B', fontWeight: '700' },
  { tag: flowchartTags.nodeEdge, color: '#64748B', fontWeight: '700' },
  { tag: flowchartTags.nodeEdgeText, color: '#9D174D', fontWeight: '600' },
  { tag: flowchartTags.string, color: '#4F46E5' },
  { tag: flowchartTags.number, color: '#0F766E' },
  { tag: flowchartTags.lineComment, color: '#8A94A6', fontStyle: 'italic' },
  { tag: t.keyword, color: '#9D174D', fontWeight: '700' },
  { tag: t.variableName, color: '#1D4ED8', fontWeight: '600' },
  { tag: t.string, color: '#4F46E5' },
  { tag: t.comment, color: '#8A94A6', fontStyle: 'italic' },
])

const startsPastRenderedText = (event: MouseEvent) => {
  const target = event.target

  if (!(target instanceof Element)) {
    return false
  }

  const line = target.closest('.cm-line')

  if (!line) {
    return target.closest('.cm-content') !== null
  }

  const range = document.createRange()
  range.selectNodeContents(line)
  const textRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
  range.detach()

  if (textRects.length === 0) {
    return true
  }

  const rowRects = textRects.filter((rect) => event.clientY >= rect.top && event.clientY <= rect.bottom)
  const activeRects = rowRects.length > 0 ? rowRects : textRects
  const furthestTextEdge = Math.max(...activeRects.map((rect) => rect.right))

  return event.clientX > furthestTextEdge + 4
}

const ignoreEmptySpaceDragSelection = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0 || !startsPastRenderedText(event)) {
      return false
    }

    const cursorPosition = view.posAtCoords({ x: event.clientX, y: event.clientY })

    event.preventDefault()
    view.focus()

    if (cursorPosition !== null) {
      view.dispatch({ selection: { anchor: cursorPosition } })
    }

    return true
  },
})

const mermaidEditorExtensions = [
  mermaid(),
  foldByIndent(),
  EditorView.lineWrapping,
  ignoreEmptySpaceDragSelection,
  mermaidEditorTheme,
  syntaxHighlighting(mermaidHighlightStyle),
]

export function MermaidPanel({
  isCollapsed,
  onToggle,
  draft,
  onDraftChange,
  onImportDraft,
  onClearDraft,
  importError,
}: MermaidPanelProps) {
  const [activeTab, setActiveTab] = useState<'mermaid' | 'examples'>('mermaid')

  if (isCollapsed) {
    return (
      <aside className="flex w-[44px] shrink-0 flex-col items-center rounded-md border border-[#E7EAF0] bg-white py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand Mermaid panel"
          aria-expanded={false}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EEE9FF] text-[#6336F1] hover:bg-[#E6DFFF]"
        >
          <ChevronRight size={16} />
        </button>
        <FileCode2 size={16} className="mt-4 text-[#64748B]" />
        <div className="mt-4 flex flex-1 items-center justify-center">
          <p className="rotate-[-90deg] whitespace-nowrap text-[10px] font-semibold tracking-[0.14em] text-[#8A94A6]">MERMAID</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-[230px] shrink-0 flex-col overflow-hidden rounded-md border border-[#E7EAF0] bg-white">
      <div className="relative flex h-[51px] shrink-0 border-b border-[#EEF0F4] px-4">
        <button
          type="button"
          onClick={() => setActiveTab('mermaid')}
          className={`relative flex flex-1 items-center justify-center text-[12px] font-medium ${
            activeTab === 'mermaid' ? 'text-[#6336F1]' : 'text-[#64748B]'
          }`}
        >
          Mermaid
          {activeTab === 'mermaid' && <span className="absolute bottom-0 h-0.5 w-[91px] rounded-full bg-[#6336F1]" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('examples')}
          className={`relative flex flex-1 items-center justify-center text-[12px] font-medium ${
            activeTab === 'examples' ? 'text-[#6336F1]' : 'text-[#64748B]'
          }`}
        >
          Examples
          {activeTab === 'examples' && <span className="absolute bottom-0 h-0.5 w-[91px] rounded-full bg-[#6336F1]" />}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse Mermaid panel"
          aria-expanded={true}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        <p className="mb-2 text-[11px] font-medium text-[#64748B]">Paste Mermaid code below</p>
        {activeTab === 'mermaid' ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-[#E7EAF0] bg-[#FAFAFC] focus-within:border-[#C7B9FF]">
            <CodeMirror
              value={draft.source}
              className="h-full min-h-0"
              height="100%"
              style={{ height: '100%' }}
              basicSetup={{
                foldGutter: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
              }}
              extensions={mermaidEditorExtensions}
              onChange={onDraftChange}
              aria-label="Mermaid source"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onDraftChange(defaultMermaid)}
            className="flex min-h-[620px] flex-1 flex-col rounded-md border border-[#E7EAF0] bg-[#FAFAFC] p-4 text-left hover:border-[#C7B9FF] hover:bg-[#F8F5FF]"
          >
            <span className="text-sm font-semibold text-[#0F172A]">Default swimlane example</span>
            <span className="mt-2 text-xs leading-5 text-[#64748B]">Load the starter Mermaid sample into the current draft.</span>
          </button>
        )}

        {importError && (
          <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
            {importError}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-[18px]">
          <button
            type="button"
            onClick={onImportDraft}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-[4px] bg-[#6336F1] px-4 text-[12px] font-medium text-white shadow-[0_8px_18px_rgba(99,54,241,0.18)] hover:bg-[#5930DE]"
          >
            <Upload size={13} />
            Import
          </button>
          <button
            type="button"
            onClick={onClearDraft}
            className="inline-flex h-7 items-center justify-center rounded-[4px] border border-[#E5E7EB] bg-white px-4 text-[12px] font-medium text-[#0F172A] hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  )
}
