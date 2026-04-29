import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Cloud,
  Download,
  Edit3,
  FileCode2,
  FolderOpen,
  Grid3X3,
  Home,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Sparkles,
  MoreHorizontal,
  Plus,
  Redo2,
  Settings,
  Share2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { MermaidPanel } from '../panels/MermaidPanel'
import { CanvasToolbar } from '../toolbar/CanvasToolbar'
import { SwimlaneCanvas } from '../canvas/SwimlaneCanvas'
import { InspectorPanel } from '../panels/InspectorPanel'
import { useEditorStore } from '../../store/editorStore'
import { defaultMermaid } from '../../lib/mermaid/defaultMermaid'

const workspaceItems = [
  { label: 'Dashboard', icon: Home },
  { label: 'Diagrams', icon: FolderOpen },
  { label: 'Templates', icon: Grid3X3 },
  { label: 'Trash', icon: Trash2 },
]

const toolItems = [
  { label: 'Import (Mermaid)', icon: FileCode2 },
  { label: 'Export', icon: Download },
  { label: 'Settings', icon: Settings },
]

type OpenPopover = null | 'more' | 'settings'

type DraftItem = {
  id: string
  name: string
  source: string
}

function VaragraphMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M13.5 7.5C19.7 5.7 25.2 11.2 28.7 20.1L34 34.1C35.7 38.6 32 45.3 25.8 43.4C20.1 41.7 16.7 34.3 13.1 26L8.7 16C6.6 11.4 9.2 8.7 13.5 7.5Z" fill="url(#varagraphLeft)" />
      <path d="M50.5 7.5C44.3 5.7 38.8 11.2 35.3 20.1L30 34.1C28.3 38.6 32 45.3 38.2 43.4C43.9 41.7 47.3 34.3 50.9 26L55.3 16C57.4 11.4 54.8 8.7 50.5 7.5Z" fill="url(#varagraphRight)" />
      <circle cx="32" cy="42.5" r="8.5" fill="#A9A0FF" fillOpacity="0.9" />
      <defs>
        <linearGradient id="varagraphLeft" x1="8" y1="8" x2="35" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9D8CFF" />
          <stop offset="1" stopColor="#5A43F0" />
        </linearGradient>
        <linearGradient id="varagraphRight" x1="56" y1="8" x2="29" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6257F5" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function SidebarSection({
  title,
  items,
  activeItem,
  onItemClick,
}: {
  title: string
  items: typeof workspaceItems
  activeItem?: string
  onItemClick: (label: string) => void
}) {
  return (
    <div>
      <p className="px-2 text-[11px] font-medium uppercase tracking-normal text-[#8A94A6]">{title}</p>
      <div className="mt-3 space-y-[5px]">
        {items.map(({ label, icon: Icon }) => {
          const active = activeItem === label
          return (
            <button
              key={label}
              type="button"
              onClick={() => onItemClick(label)}
              className={`flex h-9 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition ${
                active ? 'bg-[#EEE9FF] text-[#6336F1]' : 'text-[#374151] hover:bg-white hover:text-[#0F172A]'
              }`}
            >
              <Icon size={16} strokeWidth={1.9} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Popover({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`absolute z-50 rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_60px_rgba(15,23,42,0.12)] ${className}`}>{children}</div>
}

function TopBar({
  openPopover,
  onTogglePopover,
  onShare,
  onExport,
  onReset,
  onExportMermaid,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  openPopover: OpenPopover
  onTogglePopover: (popover: Exclude<OpenPopover, null>) => void
  onShare: () => void
  onExport: () => void
  onReset: () => void
  onExportMermaid: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  return (
    <header className="relative flex h-[60px] shrink-0 items-center justify-between border-b border-[#EEF0F4] bg-white px-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[20px] font-medium tracking-normal text-[#0F172A]">Vertical Swimlane Diagram</h1>
        <button type="button" disabled title="Rename is not available yet" aria-label="Rename diagram" className="text-[#94A3B8]">
          <Edit3 size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-4 text-[#243047]">
          <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo" className={canUndo ? 'text-[#0F172A]' : 'cursor-not-allowed text-[#9AA4B5]'}>
            <Undo2 size={16} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo" className={canRedo ? 'text-[#0F172A]' : 'cursor-not-allowed text-[#9AA4B5]'}>
            <Redo2 size={16} strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
            <Cloud size={15} strokeWidth={1.8} />
            Saved
          </div>
        </div>
        <button type="button" onClick={onShare} className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[#6336F1] px-4 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(99,54,241,0.22)] hover:bg-[#5930DE]">
          <Share2 size={15} strokeWidth={1.8} />
          Share
        </button>
        <button type="button" onClick={() => onTogglePopover('more')} aria-label="More actions" aria-expanded={openPopover === 'more'} className="text-[#0F172A]">
          <MoreHorizontal size={18} />
        </button>
      </div>
      {openPopover === 'more' && (
        <Popover className="right-6 top-12 w-44">
          <button type="button" onClick={onExport} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <Download size={15} />
            Export JSON
          </button>
          <button type="button" onClick={onExportMermaid} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <FileCode2 size={15} />
            Export Mermaid
          </button>
          <button type="button" onClick={onReset} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <FileCode2 size={15} />
            Reset starter
          </button>
        </Popover>
      )}
    </header>
  )
}

function Sidebar({
  isCollapsed,
  onToggle,
  activeWorkspaceSection,
  onWorkspaceChange,
  onImportTool,
  onExportTool,
  onSettingsTool,
}: {
  isCollapsed: boolean
  onToggle: () => void
  activeWorkspaceSection: string
  onWorkspaceChange: (label: string) => void
  onImportTool: () => void
  onExportTool: () => void
  onSettingsTool: () => void
}) {
  const handleToolClick = (label: string) => {
    if (label === 'Import (Mermaid)') onImportTool()
    if (label === 'Export') onExportTool()
    if (label === 'Settings') onSettingsTool()
  }

  if (isCollapsed) {
    return (
      <aside className="flex w-[56px] shrink-0 flex-col items-center border-r border-[#EEF0F4] bg-[#FAFAFC] py-5">
        <button type="button" onClick={onToggle} aria-label="Expand navigation sidebar" aria-expanded={false} className="mb-4 flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#334155] hover:bg-slate-50">
          <PanelLeftOpen size={15} />
        </button>
        <VaragraphMark size={24} />
        <div className="mt-8 flex flex-1 flex-col gap-2">
          {[...workspaceItems, ...toolItems].map(({ label, icon: Icon }) => {
            const active = activeWorkspaceSection === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => (toolItems.some((item) => item.label === label) ? handleToolClick(label) : onWorkspaceChange(label))}
                aria-label={label}
                title={label}
                className={`flex h-9 w-9 items-center justify-center rounded-md ${active ? 'bg-[#EEE9FF] text-[#6336F1]' : 'text-[#374151] hover:bg-white hover:text-[#0F172A]'}`}
              >
                <Icon size={16} strokeWidth={1.9} />
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-[192px] shrink-0 flex-col border-r border-[#EEF0F4] bg-[#FAFAFC] px-[10px] py-5">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <VaragraphMark size={26} />
          <p className="text-[17px] font-bold tracking-[-0.02em] text-[#0F172A]">varagraph</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse navigation sidebar"
          aria-expanded={true}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <nav className="mt-8 flex flex-1 flex-col">
        <SidebarSection title="WORKSPACE" items={workspaceItems} activeItem={activeWorkspaceSection} onItemClick={onWorkspaceChange} />
        <div className="mt-4 border-t border-[#EEF0F4] pt-4">
          <SidebarSection title="TOOLS" items={toolItems} onItemClick={handleToolClick} />
        </div>
      </nav>

      <button type="button" disabled title="Workspace account menu is not available yet" aria-label="Workspace account menu" className="mb-[-4px] rounded-md border border-[#E5E7EB] bg-white px-2 py-2 text-left">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6336F1] text-sm font-semibold text-white">A</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-[#0F172A]">andi@example.com</p>
            <p className="truncate text-[10px] text-[#8A94A6]">Pro Plan</p>
          </div>
          <ChevronRight size={13} className="text-[#94A3B8]" />
        </div>
      </button>
    </aside>
  )
}

function EditorToolbarStrip({ onAutoLayout }: { onAutoLayout: () => void }) {
  const zoom = useEditorStore((state) => state.zoom)
  const hasNodes = useEditorStore((state) => state.graph.nodes.length > 0)
  return (
    <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-[#EEF0F4] bg-white">
      <CanvasToolbar />
      <div className="absolute right-[16px] flex items-center gap-3">
        <div className="flex h-9 items-center rounded-md border border-[#EEF0F4] bg-white text-[#0F172A]">
          <button type="button" disabled aria-label="Zoom out" className="flex h-9 w-10 items-center justify-center text-lg leading-none text-[#0F172A]">
            -
          </button>
          <div className="h-5 w-px bg-[#EEF0F4]" />
          <span className="w-16 text-center text-[12px] font-medium">{Math.round(zoom * 100)}%</span>
          <div className="h-5 w-px bg-[#EEF0F4]" />
          <button type="button" disabled aria-label="Zoom in" className="flex h-9 w-10 items-center justify-center text-lg leading-none text-[#0F172A]">
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onAutoLayout}
          disabled={!hasNodes}
          aria-label="Auto layout diagram"
          title={hasNodes ? 'Auto layout diagram' : 'Add nodes before auto layout'}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#EEF0F4] bg-white px-3 text-[12px] font-semibold text-[#0F172A] hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-[#9AA4B5]"
        >
          <Maximize2 size={15} />
          Auto layout
        </button>
      </div>
    </div>
  )
}

function BottomTabs({
  draftItems,
  activeDraftId,
  onSelectDraft,
  onAddDraft,
}: {
  draftItems: DraftItem[]
  activeDraftId: string
  onSelectDraft: (id: string) => void
  onAddDraft: () => void
}) {
  return (
    <footer className="flex h-[58px] shrink-0 items-center justify-between border-t border-[#EEF0F4] bg-white px-[14px]">
      <div className="flex items-center gap-2">
        {draftItems.map((draft) => {
          const active = draft.id === activeDraftId
          return (
            <button
              key={draft.id}
              type="button"
              onClick={() => onSelectDraft(draft.id)}
              className={`flex h-9 min-w-[154px] items-center gap-2 rounded-md border px-3 text-[12px] font-medium ${active ? 'border-[#E6DFFF] bg-[#F8F5FF] text-[#6336F1]' : 'border-[#E5E7EB] text-[#64748B] hover:bg-slate-50'}`}
            >
              <FileCode2 size={14} />
              {draft.name}
            </button>
          )
        })}
        <button type="button" onClick={onAddDraft} aria-label="Add Mermaid draft" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50">
          <Plus size={16} />
        </button>
      </div>
      <button type="button" disabled aria-label="Open bottom tools" className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#0F172A]">
        <LayoutDashboard size={15} />
      </button>
    </footer>
  )
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function downloadJson(json: string) {
  downloadText(json, 'varagraph-diagram.json', 'application/json')
}

export function EditorShell() {
  const mermaidSource = useEditorStore((state) => state.mermaidSource)
  const importError = useEditorStore((state) => state.importError)
  const importMermaid = useEditorStore((state) => state.importMermaid)
  const clearMermaid = useEditorStore((state) => state.clearMermaid)
  const resetMermaid = useEditorStore((state) => state.resetMermaid)
  const importJson = useEditorStore((state) => state.importJson)
  const exportJson = useEditorStore((state) => state.exportJson)
  const exportMermaid = useEditorStore((state) => state.exportMermaid)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const canUndo = useEditorStore((state) => state.canUndo)
  const canRedo = useEditorStore((state) => state.canRedo)
  const toggleGrid = useEditorStore((state) => state.toggleGrid)
  const autoLayoutGraph = useEditorStore((state) => state.autoLayoutGraph)
  const jsonInputRef = useRef<HTMLInputElement | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isMermaidCollapsed, setIsMermaidCollapsed] = useState(true)
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(true)
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState('Diagrams')
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ id: 'draft-1', name: 'Vertical Swimlane...', source: mermaidSource }])
  const [activeDraftId, setActiveDraftId] = useState('draft-1')
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null)
  const currentDraft = draftItems.find((draft) => draft.id === activeDraftId) ?? draftItems[0]!

  useEffect(() => {
    setDraftItems((items) => items.map((item) => (item.id === activeDraftId ? { ...item, source: mermaidSource } : item)))
  }, [activeDraftId, mermaidSource])

  const setActiveDraftSource = (source: string) => {
    if (!currentDraft) return
    setDraftItems((items) => items.map((item) => (item.id === currentDraft.id ? { ...item, source } : item)))
  }

  const togglePopover = (popover: Exclude<OpenPopover, null>) => {
    setOpenPopover((current) => (current === popover ? null : popover))
  }

  const handleExport = () => {
    downloadJson(exportJson())
    setOpenPopover(null)
  }

  const handleExportMermaid = () => {
    const source = exportMermaid()
    downloadText(source, 'varagraph-diagram.mmd', 'text/plain')
    setActiveDraftSource(source)
    setOpenPopover(null)
  }

  const handleJsonFileChange = async (file: File | undefined) => {
    if (!file) return
    const source = await file.text()
    importJson(source)
    if (jsonInputRef.current) jsonInputRef.current.value = ''
  }

  const handleReset = () => {
    resetMermaid()
    setActiveDraftSource(defaultMermaid)
    setOpenPopover(null)
  }

  const handleClear = () => {
    setActiveDraftSource('')
    clearMermaid()
  }


  const handleAutoLayout = () => {
    const changed = autoLayoutGraph()
    setLayoutMessage(changed ? 'Auto layout applied' : 'Diagram already aligned')
    window.setTimeout(() => setLayoutMessage(null), 1800)
    setOpenPopover(null)
  }

  const handleShare = async () => {
    const json = exportJson()
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Varagraph diagram', text: json })
      } else {
        await navigator.clipboard.writeText(json)
      }
      setShareMessage('Share ready')
      setOpenPopover(null)
    } catch {
      setShareMessage('Share failed')
      setOpenPopover(null)
    }
  }

  const addDraft = () => {
    const id = `draft-${Date.now()}`
    setDraftItems((items) => [...items, { id, name: 'Untitled', source: '' }])
    setActiveDraftId(id)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FBFCFE] text-[#0F172A]">
      <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleJsonFileChange(event.target.files?.[0])} />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((value) => !value)}
        activeWorkspaceSection={activeWorkspaceSection}
        onWorkspaceChange={setActiveWorkspaceSection}
        onImportTool={() => setIsMermaidCollapsed(false)}
        onExportTool={handleExport}
        onSettingsTool={() => togglePopover('settings')}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar openPopover={openPopover} onTogglePopover={togglePopover} onShare={handleShare} onExport={handleExport} onExportMermaid={handleExportMermaid} onReset={handleReset} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
        <EditorToolbarStrip onAutoLayout={handleAutoLayout} />
        <main className="relative flex min-h-0 flex-1 gap-[18px] overflow-hidden bg-[#FBFCFE] px-3 pb-[10px] pt-4">
          <MermaidPanel
            isCollapsed={isMermaidCollapsed}
            onToggle={() => setIsMermaidCollapsed((value) => !value)}
            draft={currentDraft}
            onDraftChange={setActiveDraftSource}
            onImportDraft={() => importMermaid(currentDraft.source)}
            onResetDraft={handleReset}
            onClearDraft={handleClear}
            importError={importError}
          />
          <section className="mt-[18px] min-w-0 flex-1 overflow-hidden">
            <SwimlaneCanvas />
          </section>
          <InspectorPanel isCollapsed={isInspectorCollapsed} onToggle={() => setIsInspectorCollapsed((value) => !value)} />
          {openPopover === 'settings' && (
            <Popover className="left-[204px] top-6 w-48">
              <button type="button" onClick={toggleGrid} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
                <Settings size={15} />
                Toggle grid
              </button>
              <button type="button" onClick={() => jsonInputRef.current?.click()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
                <FileCode2 size={15} />
                Import JSON
              </button>
              <button type="button" onClick={handleAutoLayout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
                <LayoutDashboard size={15} />
                Auto layout
              </button>
            </Popover>
          )}
        </main>
        <BottomTabs draftItems={draftItems} activeDraftId={activeDraftId} onSelectDraft={setActiveDraftId} onAddDraft={addDraft} />
      </div>
      {shareMessage && <div className="absolute bottom-16 right-5 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg">{shareMessage}</div>}
      {layoutMessage && <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg"><Sparkles size={13} className="mr-1 inline" />{layoutMessage}</div>}
    </div>
  )
}
