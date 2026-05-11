import { useState, useRef, useEffect } from 'react'
import { FileCode2, MoreHorizontal, Plus, Search, Trash2, Copy, Edit3 } from 'lucide-react'
import { useDiagramRegistryStore } from '../../store/diagramRegistryStore'
import { useEditorStore } from '../../store/editorStore'

function formatRelative(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function DiagramItem({
  diagram,
  isActive,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: {
  diagram: { id: string; title: string; updatedAt: number }
  isActive: boolean
  onSelect: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div className={`group relative flex min-h-9 items-center gap-1.5 rounded-md px-2 text-left text-xs transition ${isActive ? 'bg-[#EEE9FF] text-[#6336F1]' : 'text-[#526074] hover:bg-white'}`}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden py-1">
        <FileCode2 size={12} strokeWidth={1.9} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <span className={`block truncate leading-4 ${isActive ? 'font-semibold text-[#4F46E5]' : 'font-medium text-[#334155]'}`}>{diagram.title}</span>
          <span className="block pt-0.5 text-[0.6875rem] font-medium text-[#94A3B8]">{formatRelative(diagram.updatedAt)}</span>
        </div>
      </button>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className={`flex h-5.5 w-5.5 items-center justify-center rounded-full transition ${isActive ? 'text-[#6336F1] hover:bg-[#E6DFFF]' : 'text-[#94A3B8] hover:bg-[#EEF0F4] hover:text-[#334155]'}`}
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 w-32 rounded-lg border border-[#E5E7EB] bg-white p-1 shadow-lg">
            <button type="button" onClick={() => { onRename(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Edit3 size={12} /> Rename
            </button>
            <button type="button" onClick={() => { onDuplicate(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Copy size={12} /> Duplicate
            </button>
            <button type="button" onClick={() => { onDelete(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-red-500 hover:bg-red-50">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InlineRename({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { inputRef.current?.select() }, [])
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value)
        if (e.key === 'Escape') onCancel()
      }}
      autoFocus
      className="min-w-0 flex-1 rounded border border-[#D9D6FE] bg-white px-1.5 py-1 text-xs font-semibold text-[#0F172A] outline-none"
    />
  )
}

export function DiagramSidebar() {
  const diagrams = useDiagramRegistryStore((s) => s.diagrams)
  const activeDiagramId = useDiagramRegistryStore((s) => s.activeDiagramId)
  const createDiagram = useDiagramRegistryStore((s) => s.createDiagram)
  const renameDiagram = useDiagramRegistryStore((s) => s.renameDiagram)
  const deleteDiagram = useDiagramRegistryStore((s) => s.deleteDiagram)
  const duplicateDiagram = useDiagramRegistryStore((s) => s.duplicateDiagram)
  const loadDiagram = useEditorStore((s) => s.loadDiagram)
  const setActiveDiagram = useDiagramRegistryStore((s) => s.setActiveDiagram)

  const [searchQuery, setSearchQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const showSearch = diagrams.length > 10
  const filtered = searchQuery
    ? diagrams.filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : diagrams

  const handleSelect = (id: string) => {
    setActiveDiagram(id)
    loadDiagram(id)
  }

  const handleCreate = () => {
    const id = createDiagram()
    loadDiagram(id)
  }

  const handleRename = (id: string) => {
    setRenamingId(id)
  }

  const handleRenameCommit = (id: string, title: string) => {
    if (title.trim()) renameDiagram(id, title.trim())
    setRenamingId(null)
  }

  const handleDuplicate = (id: string) => {
    const newId = duplicateDiagram(id)
    loadDiagram(newId)
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (!deleteConfirmId) return
    const diagrams = useDiagramRegistryStore.getState().diagrams
    const nextActive = diagrams.find((d) => d.id !== deleteConfirmId)
    deleteDiagram(deleteConfirmId)
    if (nextActive) {
      setActiveDiagram(nextActive.id)
      loadDiagram(nextActive.id)
    }
    setDeleteConfirmId(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 py-3">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-[0.625rem] font-semibold tracking-[0.12em] uppercase text-[#64748B]">DIAGRAMS</span>
        <button type="button" onClick={handleCreate} className="flex h-5.5 w-5.5 items-center justify-center rounded-md text-[#6336F1] hover:bg-[#EEE9FF]" title="New diagram">
          <Plus size={13} strokeWidth={2.1} />
        </button>
      </div>

      {showSearch && (
        <div className="mb-2 flex h-7 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2">
          <Search size={12} className="shrink-0 text-[#94A3B8]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search diagrams..."
            className="min-w-0 flex-1 text-xs font-medium text-[#0F172A] outline-none placeholder:text-[#9AA4B8]"
          />
        </div>
      )}

      <div className="flex-1 space-y-0.5 overflow-auto">
        {filtered.map((diagram) => (
          <div key={diagram.id}>
            {renamingId === diagram.id ? (
              <InlineRename
                initialValue={diagram.title}
                onCommit={(title) => handleRenameCommit(diagram.id, title)}
                onCancel={() => setRenamingId(null)}
              />
            ) : (
              <DiagramItem
                diagram={diagram}
                isActive={diagram.id === activeDiagramId}
                onSelect={() => handleSelect(diagram.id)}
                onRename={() => handleRename(diagram.id)}
                onDuplicate={() => handleDuplicate(diagram.id)}
                onDelete={() => handleDelete(diagram.id)}
              />
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-xs font-medium text-[#64748B]">{searchQuery ? 'No diagrams match your search' : 'No diagrams yet'}</p>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="w-64 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold tracking-[-0.01em] text-[#0F172A]">Delete diagram?</p>
            <p className="mt-1.5 text-xs font-medium text-[#64748B]">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="h-7 rounded-md border border-[#E5E7EB] px-3 text-xs font-semibold text-[#334155]">Cancel</button>
              <button type="button" onClick={confirmDelete} className="h-7 rounded-md bg-red-500 px-3 text-xs font-semibold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}