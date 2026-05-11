import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
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
import { SidebarFeaturePages } from './SidebarFeaturePages'
import { UserMenu } from '../cloud/UserMenu'
import { SaveIndicator } from '../cloud/SaveIndicator'
import { ShareDialog } from '../share/ShareDialog'
import { useEditorStore, setEditorReadOnly } from '../../store/editorStore'
import { useDiagramRegistryStore } from '../../store/diagramRegistryStore'
import { useAuthStore } from '../../store/authStore'
import type { GraphModel } from '../../types/graph'

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
type NavItem = { label: string; icon: typeof Home }

type DraftItem = {
  id: string
  name: string
  source: string
  graph: GraphModel
}

export type SharedEditorSession = {
  title: string
  graph: GraphModel
  diagramId: string | null
  editable: boolean
  ownerView?: boolean
  onSaveCopy?: () => void
  saveCopyPending?: boolean
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
  items: NavItem[]
  activeItem?: string
  onItemClick: (label: string) => void
}) {
  return (
    <div>
      <p className="px-2 py-1 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-[#7D8798]">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {items.map(({ label, icon: Icon }) => {
          const active = activeItem === label
          return (
            <button
              key={label}
              type="button"
              onClick={() => onItemClick(label)}
              className={`flex h-7 w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition ${
                active ? 'bg-[#EEE9FF] text-[#6336F1]' : 'text-[#526074] hover:bg-white hover:text-[#0F172A]'
              }`}
            >
              <Icon size={14} strokeWidth={1.9} className="shrink-0" />
              <span className={`whitespace-nowrap tracking-[0.01em] ${active ? 'text-[0.6875rem] font-bold' : 'text-[0.6875rem] font-semibold'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Popover({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`absolute z-50 rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-lg ${className}`}>{children}</div>
}

function TopBar({
  title,
  isRenaming,
  renameValue,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
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
  primaryActionLabel = 'Share',
  primaryActionIcon,
  primaryActionDisabled = false,
}: {
  title: string
  isRenaming: boolean
  renameValue: string
  onStartRename: () => void
  onRenameValueChange: (value: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
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
  primaryActionLabel?: string
  primaryActionIcon?: ReactNode
  primaryActionDisabled?: boolean
}) {
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.select()
  }, [isRenaming])

  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-[#EEF0F4] bg-white px-4">
      <div className="flex items-center gap-1.5">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(event) => onRenameValueChange(event.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onCommitRename()
              if (event.key === 'Escape') onCancelRename()
            }}
            className="h-7 min-w-64 rounded-md border border-[#D9D6FE] bg-white px-2 text-sm font-semibold leading-none tracking-[-0.02em] text-[#0F172A] outline-none ring-2 ring-[#EDE9FE]"
          />
        ) : (
          <button type="button" onClick={onStartRename} className="max-w-xl truncate text-left text-sm font-semibold leading-none tracking-[-0.02em] text-[#0F172A]">
            {title}
          </button>
        )}
        <button type="button" onClick={onStartRename} title="Rename diagram" aria-label="Rename diagram" className="flex h-6 w-6 items-center justify-center rounded-md text-[#94A3B8] hover:bg-slate-50 hover:text-[#6336F1]">
          <Edit3 size={12} strokeWidth={1.85} />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-[#EEF0F4] bg-white px-1.5 py-1 text-[#243047] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo" className={`flex h-6 w-6 items-center justify-center rounded-md ${canUndo ? 'text-[#0F172A] hover:bg-slate-50' : 'cursor-not-allowed text-[#9AA4B5]'}`}>
            <Undo2 size={13} strokeWidth={1.9} />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo" className={`flex h-6 w-6 items-center justify-center rounded-md ${canRedo ? 'text-[#0F172A] hover:bg-slate-50' : 'cursor-not-allowed text-[#9AA4B5]'}`}>
            <Redo2 size={13} strokeWidth={1.9} />
          </button>
          <div className="mx-0.5 h-4 w-px bg-[#EEF0F4]" />
          <div className="flex items-center gap-1 text-[0.6875rem] font-medium text-[#64748B]">
            <Cloud size={12} strokeWidth={1.8} />
            <SaveIndicator />
          </div>
        </div>
        <button type="button" onClick={onShare} disabled={primaryActionDisabled} className="inline-flex h-7 items-center gap-1 rounded-md bg-[#6336F1] px-2.5 text-ui-xs font-ui-bold tracking-tight text-white shadow-[0_6px_18px_rgba(99,54,241,0.18)] hover:bg-[#5930DE] disabled:cursor-not-allowed disabled:opacity-60">
          {primaryActionIcon ?? <Share2 size={12} strokeWidth={1.85} />}
          {primaryActionLabel}
        </button>
        <button type="button" onClick={() => onTogglePopover('more')} aria-label="More actions" aria-expanded={openPopover === 'more'} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#EEF0F4] bg-white text-[#0F172A] hover:bg-slate-50">
          <MoreHorizontal size={15} />
        </button>
      </div>
      {openPopover === 'more' && (
        <Popover className="right-4 top-10 w-40 p-1">
          <button type="button" onClick={onExport} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <Download size={14} />
            Export JSON
          </button>
          <button type="button" onClick={onExportMermaid} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <FileCode2 size={14} />
            Export Mermaid
          </button>
          <button type="button" onClick={onReset} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950">
            <FileCode2 size={14} />
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
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-[#EEF0F4] bg-[#FAFAFC] py-4">
        <button type="button" onClick={onToggle} aria-label="Expand navigation sidebar" aria-expanded={false} className="mb-3 flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#334155] hover:bg-slate-50">
          <PanelLeftOpen size={14} />
        </button>
        <VaragraphMark size={22} />
        <div className="mt-6 flex flex-1 flex-col gap-1.5">
          {[...workspaceItems, ...toolItems].map(({ label, icon: Icon }) => {
            const active = activeWorkspaceSection === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => (toolItems.some((item) => item.label === label) ? handleToolClick(label) : onWorkspaceChange(label))}
                aria-label={label}
                title={label}
                className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? 'bg-[#EEE9FF] text-[#6336F1]' : 'text-[#526074] hover:bg-white hover:text-[#0F172A]'}`}
              >
                <Icon size={15} strokeWidth={1.9} />
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-[#EEF0F4] bg-[#FAFAFC] px-2 py-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <VaragraphMark size={22} />
          <p className="text-xs font-bold tracking-[-0.015em] text-[#0F172A]">varagraph</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse navigation sidebar"
          aria-expanded={true}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50"
        >
          <PanelLeftClose size={12} />
        </button>
      </div>

      <nav className="mt-4 flex flex-1 flex-col">
        <SidebarSection title="WORKSPACE" items={workspaceItems} activeItem={activeWorkspaceSection} onItemClick={onWorkspaceChange} />
        <div className="mt-2 border-t border-[#EEF0F4] pt-2.5">
          <SidebarSection title="TOOLS" items={toolItems} activeItem={activeWorkspaceSection} onItemClick={handleToolClick} />
        </div>
      </nav>

      <UserMenu />
    </aside>
  )
}

function EditorToolbarStrip({ onAutoLayout, readOnly = false }: { onAutoLayout: () => void; readOnly?: boolean }) {
  const zoom = useEditorStore((state) => state.zoom)
  const hasNodes = useEditorStore((state) => state.graph.nodes.length > 0)
  return (
    <div className="relative flex h-12 shrink-0 items-center justify-center border-b border-[#EEF0F4] bg-white">
      <CanvasToolbar readOnly={readOnly} />
      <div className="absolute right-3 flex items-center gap-2">
        <div className="flex h-6 items-center rounded-md border border-[#EEF0F4] bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <button type="button" disabled aria-label="Zoom out" className="flex h-6 w-7 items-center justify-center text-xs leading-none text-[#0F172A]">
            -
          </button>
          <div className="h-3.5 w-px bg-[#EEF0F4]" />
          <span className="w-12 text-center text-[0.6875rem] font-semibold">{Math.round(zoom * 100)}%</span>
          <div className="h-3.5 w-px bg-[#EEF0F4]" />
          <button type="button" disabled aria-label="Zoom in" className="flex h-6 w-7 items-center justify-center text-xs leading-none text-[#0F172A]">
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onAutoLayout}
          disabled={!hasNodes || readOnly}
          aria-label="Auto layout diagram"
          title={readOnly ? 'Disabled in read-only view' : hasNodes ? 'Auto layout diagram' : 'Add nodes before auto layout'}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#EEF0F4] bg-white px-2 text-ui-xs font-ui-bold tracking-tight text-[#0F172A] hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-[#9AA4B5]"
        >
          <Maximize2 size={12} />
          Auto layout
        </button>
      </div>
    </div>
  )
}

function BottomTabs({
  draftItems,
  activeDraftId,
  renamingDraftId,
  renameValue,
  onSelectDraft,
  onAddDraft,
  onRenameDraft,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
}: {
  draftItems: DraftItem[]
  activeDraftId: string
  renamingDraftId: string | null
  renameValue: string
  onSelectDraft: (id: string) => void
  onAddDraft: () => void
  onRenameDraft: (id: string) => void
  onRenameValueChange: (value: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
}) {
  return (
    <footer className="flex h-10 shrink-0 items-center justify-between border-t border-[#EEF0F4] bg-white px-3">
      <div className="flex items-center gap-1.5">
        {draftItems.map((draft) => {
          const active = draft.id === activeDraftId
          const renaming = draft.id === renamingDraftId
          return (
            <div key={draft.id} className={`group flex h-7 min-w-32 max-w-48 items-center gap-1.5 rounded-md border px-2 text-xs ${active ? 'border-[#DDD5FF] bg-[#F7F4FF] font-semibold text-[#4F46E5]' : 'border-[#E5E7EB] font-medium text-[#64748B] hover:bg-slate-50'}`}>
              <button type="button" onClick={() => onSelectDraft(draft.id)} aria-label={`Open ${draft.name}`} className="shrink-0 text-current">
                <FileCode2 size={13} />
              </button>
              {renaming ? (
                <input
                  value={renameValue}
                  onChange={(event) => onRenameValueChange(event.target.value)}
                  onBlur={onCommitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onCommitRename()
                    if (event.key === 'Escape') onCancelRename()
                  }}
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-[#D9D6FE] bg-white px-1 text-left text-xs font-medium text-[#0F172A] outline-none"
                />
              ) : (
                <button type="button" onClick={() => onSelectDraft(draft.id)} onDoubleClick={() => onRenameDraft(draft.id)} className="min-w-0 flex-1 truncate text-left tracking-[0.01em]">
                  {draft.name}
                </button>
              )}
            </div>
          )
        })}
        <button type="button" onClick={onAddDraft} aria-label="Add Mermaid draft" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-slate-50">
          <Plus size={14} />
        </button>
      </div>
      <button type="button" disabled aria-label="Open bottom tools" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#0F172A]">
        <LayoutDashboard size={14} />
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

export function EditorShell({ sharedSession }: { sharedSession?: SharedEditorSession | null } = {}) {
  const mermaidSource = useEditorStore((state) => state.mermaidSource)
  const graph = useEditorStore((state) => state.graph)
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
  const loadDiagram = useEditorStore((state) => state.loadDiagram)
  const loadExternalDiagram = useEditorStore((state) => state.loadExternalDiagram)

  const diagrams = useDiagramRegistryStore((s) => s.diagrams)
  const activeDiagramId = useDiagramRegistryStore((s) => s.activeDiagramId)
  const createDiagram = useDiagramRegistryStore((s) => s.createDiagram)
  const setActiveDiagram = useDiagramRegistryStore((s) => s.setActiveDiagram)
  const renameDiagram = useDiagramRegistryStore((s) => s.renameDiagram)
  const loadRegistry = useDiagramRegistryStore((s) => s.loadRegistry)
  const syncFromCloud = useDiagramRegistryStore((s) => s.syncFromCloud)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  const jsonInputRef = useRef<HTMLInputElement | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMermaidCollapsed, setIsMermaidCollapsed] = useState(true)
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(true)
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState(() => {
    const hashSection = window.location.hash.replace('#', '')
    if (hashSection === 'templates') return 'Templates'
    if (hashSection === 'diagrams') return 'Diagrams'
    if (hashSection === 'import') return 'Import (Mermaid)'
    if (hashSection === 'export') return 'Export'
    if (hashSection === 'settings') return 'Settings'
    return 'Dashboard'
  })
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [renamingDraftId, setRenamingDraftId] = useState<string | null>(null)
  const [renamingLocation, setRenamingLocation] = useState<'header' | 'tab' | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const isCancelingRenameRef = useRef(false)
  const [shareMessage] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null)

  const activeDiagram = diagrams.find((d) => d.id === activeDiagramId)
  const shareTargetId = sharedSession?.diagramId ?? activeDiagramId
  const isSharedReadOnly = Boolean(sharedSession && !sharedSession.editable)
  const currentTitle = sharedSession?.title ?? activeDiagram?.title ?? 'Untitled'
  const isRenamingHeader = !isSharedReadOnly && renamingDraftId === activeDiagramId && renamingLocation === 'header'

  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    loadRegistry()
    checkAuth()
  }, [])

  useEffect(() => {
    setEditorReadOnly(Boolean(sharedSession && !sharedSession.editable))
    return () => setEditorReadOnly(false)
  }, [sharedSession?.editable, sharedSession])

  useEffect(() => {
    if (sharedSession) {
      loadExternalDiagram(sharedSession.graph, '', sharedSession.diagramId)
      return
    }
    if (activeDiagramId) loadDiagram(activeDiagramId)
  }, [activeDiagramId])

  useEffect(() => {
    if (sharedSession) {
      loadExternalDiagram(sharedSession.graph, '', sharedSession.diagramId)
    }
  }, [sharedSession])

  useEffect(() => {
    if (user && !isSharedReadOnly) {
      syncFromCloud()
    }
  }, [user, isSharedReadOnly])

  useEffect(() => {
    if (sharedSession) setActiveWorkspaceSection('Diagrams')
  }, [sharedSession])

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
    setOpenPopover(null)
  }

  const handleClear = () => {
    clearMermaid()
  }

  const handleDraftChange = (source: string) => {
    useEditorStore.setState({ mermaidSource: source, importError: null })
  }

  const handleAutoLayout = () => {
    if (isSharedReadOnly) return
    const changed = autoLayoutGraph()
    setLayoutMessage(changed ? 'Auto layout applied' : 'Diagram already aligned')
    window.setTimeout(() => setLayoutMessage(null), 1800)
    setOpenPopover(null)
  }

  const handleShare = () => {
    if (sharedSession && !sharedSession.editable) {
      sharedSession.onSaveCopy?.()
      setOpenPopover(null)
      return
    }
    if (!shareTargetId) return
    setShareDialogOpen(true)
    setOpenPopover(null)
  }

  const startRenameDraft = (id: string, location: 'header' | 'tab') => {
    const diagram = diagrams.find((d) => d.id === id)
    if (!diagram) return
    if (id !== activeDiagramId) {
      setActiveDiagram(id)
      loadDiagram(id)
    }
    setRenamingDraftId(id)
    setRenamingLocation(location)
    setRenameValue(diagram.title)
  }

  const commitRenameDraft = () => {
    if (isCancelingRenameRef.current) {
      isCancelingRenameRef.current = false
      return
    }
    if (!renamingDraftId) return
    const name = renameValue.trim()
    if (name) renameDiagram(renamingDraftId, name)
    setRenamingDraftId(null)
    setRenamingLocation(null)
    setRenameValue('')
  }

  const cancelRenameDraft = () => {
    isCancelingRenameRef.current = true
    setRenamingDraftId(null)
    setRenamingLocation(null)
    setRenameValue('')
  }

  const selectDraft = (id: string) => {
    const diagram = diagrams.find((d) => d.id === id)
    if (!diagram) return
    setActiveDiagram(id)
    loadDiagram(id)
    setActiveWorkspaceSection('Diagrams')
  }

  const addDraft = () => {
    const id = createDiagram()
    loadDiagram(id)
    setActiveWorkspaceSection('Diagrams')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FBFCFE] text-[#0F172A]">
      <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleJsonFileChange(event.target.files?.[0])} />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((value) => !value)}
        activeWorkspaceSection={activeWorkspaceSection}
        onWorkspaceChange={setActiveWorkspaceSection}
        onImportTool={() => setActiveWorkspaceSection('Import (Mermaid)')}
        onExportTool={() => setActiveWorkspaceSection('Export')}
        onSettingsTool={() => setActiveWorkspaceSection('Settings')}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {activeWorkspaceSection === 'Diagrams' ? (
          <>
            <TopBar
              title={currentTitle}
              isRenaming={isRenamingHeader}
              renameValue={renameValue}
              onStartRename={() => !isSharedReadOnly && activeDiagramId && startRenameDraft(activeDiagramId, 'header')}
              onRenameValueChange={setRenameValue}
              onCommitRename={commitRenameDraft}
              onCancelRename={cancelRenameDraft}
              openPopover={openPopover}
              onTogglePopover={togglePopover}
              onShare={handleShare}
              onExport={handleExport}
              onExportMermaid={handleExportMermaid}
              onReset={handleReset}
              onUndo={undo}
              onRedo={redo}
              canUndo={isSharedReadOnly ? false : canUndo}
              canRedo={isSharedReadOnly ? false : canRedo}
              primaryActionLabel={sharedSession && !sharedSession.editable ? (sharedSession.saveCopyPending ? 'Saving…' : 'Save copy') : 'Share'}
              primaryActionDisabled={Boolean(sharedSession && !sharedSession.editable && !sharedSession.onSaveCopy) || Boolean(sharedSession?.saveCopyPending)}
              primaryActionIcon={sharedSession && !sharedSession.editable ? <Plus size={12} strokeWidth={1.85} /> : undefined}
            />
            <EditorToolbarStrip onAutoLayout={handleAutoLayout} readOnly={isSharedReadOnly} />
            <main className="relative flex min-h-0 flex-1 gap-4 overflow-hidden bg-[#FBFCFE] px-3 pb-2.5 pt-4">
              <MermaidPanel
                isCollapsed={isSharedReadOnly ? true : isMermaidCollapsed}
                onToggle={() => setIsMermaidCollapsed((value) => !value)}
                draft={{ id: activeDiagramId ?? '', name: currentTitle, source: mermaidSource }}
                onDraftChange={handleDraftChange}
                onImportDraft={() => importMermaid(mermaidSource)}
                onClearDraft={handleClear}
                importError={importError}
              />
              <section className="mt-4 min-w-0 flex-1 overflow-hidden">
                <SwimlaneCanvas readOnly={isSharedReadOnly} />
              </section>
              {sharedSession && !sharedSession.editable ? null : <InspectorPanel isCollapsed={isInspectorCollapsed} onToggle={() => setIsInspectorCollapsed((value) => !value)} />}
              {openPopover === 'settings' && (
                <Popover className="left-52 top-6 w-48">
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
            <BottomTabs
              draftItems={diagrams.slice(0, 5).map((d) => ({ id: d.id, name: d.title, source: mermaidSource, graph }))}
              activeDraftId={activeDiagramId ?? ''}
              renamingDraftId={renamingLocation === 'tab' ? renamingDraftId : null}
              renameValue={renameValue}
              onSelectDraft={selectDraft}
              onAddDraft={addDraft}
              onRenameDraft={(id) => startRenameDraft(id, 'tab')}
              onRenameValueChange={setRenameValue}
              onCommitRename={commitRenameDraft}
              onCancelRename={cancelRenameDraft}
            />
          </>
        ) : (
          <SidebarFeaturePages
            activeSection={activeWorkspaceSection}
            draft={{ id: activeDiagramId ?? '', name: currentTitle, source: mermaidSource }}
            importError={importError}
            onDraftChange={handleDraftChange}
            onImportDraft={() => importMermaid(mermaidSource)}
            onNewDiagram={addDraft}
            onGoToSection={setActiveWorkspaceSection}
            onExportJson={handleExport}
            onExportMermaid={handleExportMermaid}
          />
        )}
      </div>
      {shareMessage && <div className="absolute bottom-16 right-5 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg">{shareMessage}</div>}
      {layoutMessage && <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg"><Sparkles size={13} className="mr-1 inline" />{layoutMessage}</div>}
      {shareTargetId ? (
        <ShareDialog diagramId={shareTargetId} open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} />
      ) : null}
    </div>
  )
}
