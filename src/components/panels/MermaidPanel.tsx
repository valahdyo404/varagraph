import { useState } from 'react'
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
  onResetDraft: () => void
  onClearDraft: () => void
  importError: string | null
}

const highlightLine = (line: string) => {
  const tokens = line.split(/(flowchart|subgraph|end|-->|--|[\[\]{}()])/g).filter(Boolean)
  return tokens.map((token, index) => {
    let color = '#4637A8'
    let weight = 600

    if (token === 'flowchart' || token === 'subgraph' || token === 'end') {
      color = '#0F172A'
      weight = 700
    } else if (token === 'LR' || /^[A-Z]\d?$/.test(token.trim())) {
      color = '#1D4ED8'
      weight = 700
    } else if (token === '-->' || token === '--') {
      color = '#64748B'
      weight = 700
    } else if (/Workflow|Initiation|Preparation|Execution|Processing|Exception|Finalization|Begin|Operational|Satisfied|Retry|Terminate/.test(token)) {
      color = '#9D174D'
      weight = 600
    } else if (/Process|Validate|Finalize|Complete|Output|Input|Assigned|Task|Operation|Handling/.test(token)) {
      color = '#4F46E5'
      weight = 600
    }

    return (
      <span key={`${token}-${index}`} style={{ color, fontWeight: weight }}>
        {token}
      </span>
    )
  })
}

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
  const [scrollTop, setScrollTop] = useState(0)
  const lines = Math.max(27, draft.source.split('\n').length)
  const sourceLines = draft.source.split('\n')

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
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-[#E7EAF0] bg-[#FAFAFC]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="flex" style={{ transform: `translateY(-${scrollTop}px)` }}>
                <div className="select-none bg-[#F8FAFC] px-2 py-2 text-right font-mono text-[9px] leading-[17px] text-[#64748B]">
                  {Array.from({ length: lines }, (_, index) => (
                    <div key={index}>{index + 1}</div>
                  ))}
                </div>
                <pre className="m-0 flex-1 whitespace-pre-wrap break-words px-2 py-2 pr-4 font-mono text-[9px] leading-[17px]">
                  {sourceLines.map((line, index) => (
                    <span key={`${index}-${line}`}>
                      {line ? highlightLine(line) : ' '}
                      {'\n'}
                    </span>
                  ))}
                </pre>
              </div>
            </div>
            <textarea
              value={draft.source}
              onChange={(event) => onDraftChange(event.target.value)}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
              spellCheck={false}
              className="soft-scrollbar absolute inset-0 resize-none border-0 bg-transparent pl-9 pr-2 pt-2 font-mono text-[9px] leading-[17px] text-transparent caret-[#6336F1] outline-none"
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
