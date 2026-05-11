import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, Cloud, Code2, Download, Eye, ExternalLink, FileCode2, FileImage, FileText, GitFork, Grid3X3, Heart, MoreHorizontal, Plus, RefreshCw, Search, Settings, SlidersHorizontal, Upload, Zap } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useDiagramRegistryStore } from '../../store/diagramRegistryStore'
import { useAuthStore } from '../../store/authStore'
import { SwimlaneCanvas } from '../canvas/SwimlaneCanvas'
import { downloadDiagramElementPng, getDiagramBounds } from '../../lib/graph/exportDiagramImage'

type DraftLike = {
  id: string
  name: string
  source: string
}

type SidebarFeaturePagesProps = {
  activeSection: string
  draft: DraftLike
  importError: string | null
  onDraftChange: (source: string) => void
  onImportDraft: () => void
  onNewDiagram: () => void
  onGoToSection: (section: string) => void
  onExportJson: () => void
  onExportMermaid: () => void
}

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

const deletedRows = [
  ['Old Process Flow', 'May 20, 2024 10:30 AM', '27 days'],
  ['Test Diagram', 'May 18, 2024 03:15 PM', '25 days'],
  ['Backup Workflow', 'May 15, 2024 11:45 AM', '22 days'],
  ['Sample Diagram', 'May 10, 2024 09:20 AM', '17 days'],
]


function VaragraphLogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M13.5 7.5C19.7 5.7 25.2 11.2 28.7 20.1L34 34.1C35.7 38.6 32 45.3 25.8 43.4C20.1 41.7 16.7 34.3 13.1 26L8.7 16C6.6 11.4 9.2 8.7 13.5 7.5Z" fill="url(#settingsVaragraphLeft)" />
      <path d="M50.5 7.5C44.3 5.7 38.8 11.2 35.3 20.1L30 34.1C28.3 38.6 32 45.3 38.2 43.4C43.9 41.7 47.3 34.3 50.9 26L55.3 16C57.4 11.4 54.8 8.7 50.5 7.5Z" fill="url(#settingsVaragraphRight)" />
      <circle cx="32" cy="42.5" r="8.5" fill="#A9A0FF" fillOpacity="0.9" />
      <defs>
        <linearGradient id="settingsVaragraphLeft" x1="8" y1="8" x2="35" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9D8CFF" />
          <stop offset="1" stopColor="#5A43F0" />
        </linearGradient>
        <linearGradient id="settingsVaragraphRight" x1="56" y1="8" x2="29" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6257F5" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function PageShell({ title, children, searchPlaceholder = 'Search diagrams...', onNewDiagram }: { title: string; children: ReactNode; searchPlaceholder?: string; onNewDiagram: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#EEF0F4] bg-white px-4">
        <h1 className="text-xs font-bold leading-none tracking-tight text-[#0F172A]">{title}</h1>
        <div className="flex items-center gap-2">
          <label className="flex h-7 w-56 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 text-[#94A3B8]">
            <Search size={13} />
            <input aria-label={searchPlaceholder} placeholder={searchPlaceholder} className="min-w-0 flex-1 text-[#0F172A] outline-none placeholder:text-[#9AA4B5]" style={{ fontSize: '0.6875rem', fontWeight: 500 }} />
          </label>
          <Cloud size={14} className="text-[#475569]" />
          <Bell size={14} className="text-[#475569]" />
          <button type="button" onClick={onNewDiagram} className="inline-flex h-6.5 items-center gap-1 rounded-md bg-[#6336F1] px-2 text-white shadow-sm hover:bg-[#5930DE]">
            <Plus size={12} />
            <span className="text-[0.6875rem] font-extrabold tracking-tight">New Diagram</span>
          </button>
        </div>
      </header>
      <main className="soft-scrollbar min-h-0 flex-1 overflow-auto bg-white px-4 py-3.5">{children}</main>
    </div>
  )
}

function StatCard({ title, value, delta, icon }: { title: string; value: string; delta: string; icon: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#E7EAF0] bg-white p-2.5 shadow-[0_0.5rem_1.25rem_rgba(15,23,42,0.02)]">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#475569]">{title}</p>
          <p className="mt-1 text-base font-bold leading-none tracking-tight text-[#0F172A]">{value}</p>
        </div>
        <div className="text-[#6336F1]">{icon}</div>
      </div>
      <p className="mt-1 text-[0.625rem] font-medium text-[#64748B]">↑ {delta} from last month</p>
    </section>
  )
}

function ActiveCanvasPreview({ className = '' }: { className?: string }) {
  const graph = useEditorStore((state) => state.graph)
  const bounds = useMemo(() => getDiagramBounds(graph), [graph])
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const updateSize = () => setFrameSize({ width: frame.clientWidth, height: frame.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const scale = frameSize.width > 0 && frameSize.height > 0 ? Math.min(1, frameSize.width / bounds.width, frameSize.height / bounds.height) : 1
  const scaledWidth = bounds.width * scale
  const scaledHeight = bounds.height * scale

  return (
    <div ref={frameRef} className={`relative overflow-hidden rounded-md border border-[#E7EAF0] bg-white ${className}`}>
      <div
        className="absolute left-1/2 top-1/2 bg-white"
        style={{ width: bounds.width, height: bounds.height, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
      >
        <SwimlaneCanvas readOnly viewportOverride={bounds.viewport} canvasHeightOverride={bounds.canvasHeight} />
      </div>
      {scaledWidth < frameSize.width - 12 || scaledHeight < frameSize.height - 12 ? (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-white/85 px-2 py-1 text-[0.625rem] font-semibold text-[#64748B] shadow-sm">
          Fit full diagram
        </div>
      ) : null}
    </div>
  )
}



function DashboardPage({ onNewDiagram, onGoToSection }: Pick<SidebarFeaturePagesProps, 'onNewDiagram' | 'onGoToSection'>) {
  const diagrams = useDiagramRegistryStore((s) => s.diagrams)
  const setActiveDiagram = useDiagramRegistryStore((s) => s.setActiveDiagram)
  const loadDiagram = useEditorStore((s) => s.loadDiagram)
  const syncFromCloud = useDiagramRegistryStore((s) => s.syncFromCloud)
  const user = useAuthStore((s) => s.user)

  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setIsLoading(true)
      setLoadError(null)
      syncFromCloud()
        .catch(() => setLoadError('Unable to load from cloud'))
        .finally(() => setIsLoading(false))
    }
  }, [user])

  const recentDiagrams = [...diagrams]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10)

  const handleSelectDiagram = (id: string) => {
    setActiveDiagram(id)
    loadDiagram(id)
    onGoToSection('Diagrams')
  }

  const handleRetry = () => {
    setIsLoading(true)
    setLoadError(null)
    syncFromCloud()
      .catch(() => setLoadError('Unable to load from cloud'))
      .finally(() => setIsLoading(false))
  }

  return (
    <PageShell title="Dashboard" onNewDiagram={onNewDiagram}>
      {isLoading && (
        <div className="mb-3 flex items-center gap-1.5 text-[0.6875rem] text-[#64748B]">
          <RefreshCw size={13} className="animate-spin" />
          Loading diagrams...
        </div>
      )}
      {loadError && (
        <div className="mb-3 flex items-center gap-2.5 rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
          <span className="text-[0.6875rem] font-medium text-orange-700">{loadError}</span>
          <button type="button" onClick={handleRetry} className="text-[0.6875rem] font-semibold text-[#6336F1] hover:underline">
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Total Diagrams" value={String(diagrams.length)} delta="12%" icon={<FileCode2 size={18} />} />
        <StatCard title="Last Updated" value={recentDiagrams.length > 0 ? formatRelative(recentDiagrams[0].updatedAt) : '—'} delta="" icon={<Zap size={18} className="text-[#FB923C]" />} />
        <StatCard title="Total Nodes" value="—" delta="" icon={<Settings size={18} className="text-[#10B981]" />} />
        <section className="rounded-lg border border-[#E7EAF0] bg-white p-2.5 shadow-[0_0.5rem_1.25rem_rgba(15,23,42,0.02)]">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#475569]">Local Diagrams</p>
          <p className="mt-1 text-base font-bold leading-none tracking-tight text-[#0F172A]">{diagrams.length}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-[#EEF0F4]"><div className="h-1.5 w-full rounded-full bg-[#8B5CF6]" /></div>
            <span className="text-[0.625rem] font-semibold text-[#475569]">synced</span>
          </div>
        </section>
      </div>
      <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_15rem] items-start gap-3">
        <div className="space-y-3">
          <section className="rounded-lg border border-[#E7EAF0] bg-white p-3.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold tracking-tight text-[#0F172A]">Recent Diagrams</h2>
              <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.05em] text-[#64748B]">{recentDiagrams.length} items</span>
            </div>
            <div className="mt-2.5 space-y-0.5">
              {recentDiagrams.length === 0 ? (
                <p className="py-3 text-center text-[0.6875rem] text-[#94A3B8]">No diagrams yet. Create your first one!</p>
              ) : (
                recentDiagrams.map((diagram) => (
                  <button key={diagram.id} type="button" onClick={() => handleSelectDiagram(diagram.id)} className="grid min-h-7.5 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-[#F8F9FB]">
                    <span className="min-w-0 truncate text-[0.6875rem] font-bold text-[#0F172A]">{diagram.title}</span>
                    <span className="shrink-0 text-[0.5625rem] font-medium uppercase tracking-[0.04em] text-[#64748B]">{formatRelative(diagram.updatedAt)}</span>
                  </button>
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-[#E7EAF0] bg-white p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold tracking-tight text-[#0F172A]">Active Preview</h2>
                <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.05em] text-[#64748B]">Current workspace</p>
              </div>
              <button type="button" onClick={() => onGoToSection('Diagrams')} className="inline-flex items-center rounded-full bg-[#F6F1FF] px-2.5 py-1 text-[#6336F1] shadow-[0_0.375rem_1rem_rgba(99,54,241,0.08)] transition hover:bg-[#EEE9FF]">
                <span className="text-[0.5625rem] font-extrabold uppercase tracking-[0.02em]">Open editor</span>
              </button>
            </div>
            <div className="mt-3">
              <ActiveCanvasPreview className="h-64" />
            </div>
          </section>
        </div>
        <section className="rounded-lg border border-[#E7EAF0] bg-white p-3">
          <h2 className="text-xs font-bold tracking-tight text-[#0F172A]">Quick Actions</h2>
          <div className="mt-2.5 space-y-1.5">
            <QuickAction icon={<Plus size={14} />} title="Create New Diagram" description="Start from scratch" onClick={onNewDiagram} />
            <QuickAction icon={<Upload size={14} />} title="Import Mermaid" description="Import .mmd file" onClick={() => onGoToSection('Import (Mermaid)')} />
            <QuickAction icon={<Grid3X3 size={14} />} title="Browse Templates" description="Use a template" onClick={() => onGoToSection('Templates')} />
            <QuickAction icon={<FileText size={14} />} title="Documentation" description="Learn how to use Varagraph" onClick={() => onGoToSection('Settings')} />
          </div>
        </section>
      </div>
    </PageShell>
  )
}

function QuickAction({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-md border border-[#E7EAF0] bg-white p-2 text-left hover:border-[#C7B9FF] hover:bg-[#F8F5FF]">
      <span className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-[#EEE9FF] text-[#6336F1]">{icon}</span>
      <span>
        <span className="block text-[0.6875rem] font-bold tracking-tight text-[#0F172A]">{title}</span>
        <span className="block text-[0.625rem] font-medium text-[#64748B]">{description}</span>
      </span>
    </button>
  )
}

const detailTemplates = [
  {
    title: 'Vertical Swimlane – Basic Process',
    description: 'A basic vertical swimlane diagram for process visualization.',
    tag: 'Business Process',
    uses: '1.2k uses',
    theme: 'purple',
    selected: true,
    lanes: ['Initiation', 'Planning', 'Execution', 'Monitoring', 'Closing'],
    nodes: [
      ['Start Process', 10, 20, 'pill-purple'],
      ['Define\nObjectives', 27, 30, 'blue'],
      ['Execute Task', 48, 43, 'green'],
      ['Monitor\nProgress', 68, 49, 'green'],
      ['End Process', 88, 61, 'pink'],
      ['On Track?', 50, 61, 'diamond'],
      ['Complete', 48, 79, 'green'],
    ],
    paths: ['M18 29 H28 V38 H43 V50', 'M55 50 H66', 'M77 58 H87', 'M50 67 V76'],
  },
  {
    title: 'IT Support – Ticket Resolution',
    description: 'IT ticket resolution process across multiple teams.',
    tag: 'IT & Development',
    uses: '893 uses',
    theme: 'green',
    lanes: ['Requester', 'IT Support', 'IT Team', 'Vendor', 'Closure'],
    nodes: [
      ['Submit\nRequest', 9, 18, 'pill-purple'],
      ['Review\nRequest', 28, 24, 'blue'],
      ['Can Resolve?', 47, 38, 'diamond'],
      ['Resolve Issue', 47, 61, 'green'],
      ['Escalate\nto Vendor', 67, 47, 'orange'],
      ['Work\nNeeded', 85, 58, 'pink'],
      ['Close', 91, 78, 'pill-purple'],
    ],
    paths: ['M18 25 H29', 'M37 30 H46 V38', 'M48 48 V58', 'M58 40 H68', 'M75 54 H84 V66 H91'],
  },
  {
    title: 'HR – Recruitment Process',
    description: 'End-to-end recruitment workflow from requisition to onboarding.',
    tag: 'HR',
    uses: '1.1k uses',
    theme: 'green',
    lanes: ['Recruiter', 'Hiring Manager', 'HR', 'Candidate', 'Onboarding'],
    nodes: [
      ['Create Job\nRequisition', 10, 18, 'pill-purple'],
      ['Review &\nApprove', 29, 27, 'blue'],
      ['Post Job', 48, 42, 'green'],
      ['Shortlist?', 47, 62, 'diamond'],
      ['Interview', 62, 78, 'green'],
      ['Apply', 67, 52, 'green'],
      ['Reject', 88, 62, 'pink'],
    ],
    paths: ['M18 25 H29', 'M38 32 H48 V43', 'M49 50 V59', 'M56 63 H88', 'M51 69 V78 H62'],
  },
  {
    title: 'Product Development Lifecycle',
    description: 'Product development process from idea to release.',
    tag: 'IT & Development',
    uses: '1.5k uses',
    theme: 'green',
    lanes: ['Product', 'Design', 'Development', 'QA', 'Release'],
    nodes: [
      ['Define Feature', 10, 18, 'pill-purple'],
      ['Design\nSolution', 32, 31, 'blue'],
      ['Implement\nFeature', 55, 44, 'green'],
      ['Test\nFeature', 72, 58, 'green'],
      ['Pass?', 75, 76, 'diamond'],
      ['Release', 91, 88, 'blue'],
    ],
    paths: ['M18 25 H32 V38', 'M40 39 H55 V51', 'M63 51 H73 V62', 'M78 80 H91'],
  },
  {
    title: 'Purchase Order Process',
    description: 'Procurement workflow from request to payment.',
    tag: 'Operations',
    uses: '743 uses',
    theme: 'red',
    lanes: ['Buyer', 'Procurement', 'Finance', 'Supplier', 'Receiving'],
    nodes: [
      ['Create PR', 10, 17, 'pill-purple'],
      ['Review PR', 30, 25, 'blue'],
      ['Approve?', 48, 42, 'diamond'],
      ['Create PO', 47, 58, 'green'],
      ['Deliver Goods', 67, 74, 'blue'],
      ['Receive &\nInspect', 88, 81, 'blue'],
      ['Pay Invoice', 88, 95, 'pink'],
      ['Reject PR', 66, 43, 'pink'],
    ],
    paths: ['M18 23 H30', 'M37 30 H47 V39', 'M50 50 V57', 'M55 61 H66 V74', 'M75 79 H88'],
  },
  {
    title: 'Contract Approval Process',
    description: 'Contract approval workflow with legal and finance validation.',
    tag: 'Business Process',
    uses: '651 uses',
    theme: 'purple',
    lanes: ['Initiator', 'Legal', 'Finance', 'Approver', 'Archive'],
    nodes: [
      ['Submit Contract', 10, 20, 'pill-purple'],
      ['Legal Review', 31, 31, 'blue'],
      ['Approved?', 50, 50, 'diamond'],
      ['Finance Review', 50, 66, 'green'],
      ['Budget OK?', 67, 78, 'diamond'],
      ['Request\nChanges', 82, 57, 'orange'],
      ['Reject', 88, 79, 'pink'],
      ['Sign & Archive', 83, 92, 'green'],
    ],
    paths: ['M18 25 H31', 'M40 35 H50 V47', 'M54 53 H82', 'M51 56 V66', 'M58 70 H67 V75', 'M72 84 H84'],
  },
  {
    title: 'Order Fulfillment Process',
    description: 'Order fulfillment process from order placement to delivery.',
    tag: 'Business Process',
    uses: '1.3k uses',
    theme: 'purple',
    lanes: ['Customer', 'Sales', 'Logistics', 'Warehouse', 'Delivery'],
    nodes: [
      ['Place Order', 10, 20, 'pill-purple'],
      ['Confirm Order', 31, 32, 'blue'],
      ['Prepare\nShipment', 55, 48, 'blue'],
      ['Pick Items', 72, 61, 'green'],
      ['Ship Order', 88, 70, 'green'],
      ['Deliver Order', 88, 86, 'green'],
      ['Confirm\nDelivery', 88, 97, 'green'],
    ],
    paths: ['M18 25 H31', 'M40 35 H55 V48', 'M64 52 H72 V61', 'M80 64 H88 V70', 'M90 76 V86'],
  },
  {
    title: 'Bug Resolution Workflow',
    description: 'Bug resolution process from reporting to deployment.',
    tag: 'IT & Development',
    uses: '968 uses',
    theme: 'green',
    lanes: ['User', 'Support', 'Engineering', 'QA', 'Deploy'],
    nodes: [
      ['Report Bug', 10, 19, 'pill-purple'],
      ['Triage Issue', 31, 32, 'blue'],
      ['Fix Issue', 55, 48, 'blue'],
      ['Test Fix', 72, 61, 'green'],
      ['Verified?', 74, 78, 'diamond'],
      ['Deploy Fix', 91, 91, 'blue'],
    ],
    paths: ['M18 25 H31', 'M40 35 H55 V48', 'M56 57 V74 H72', 'M79 82 H91'],
  },
] as const

function TemplatesPage({ onNewDiagram, onGoToSection }: Pick<SidebarFeaturePagesProps, 'onNewDiagram' | 'onGoToSection'>) {
  const filters = ['All', 'Business Process', 'IT & Development', 'Project Management', 'Operations', 'HR', 'Other']
  const [activeCategory, setActiveCategory] = useState('All')
  const visibleTemplates = activeCategory === 'All' ? detailTemplates : detailTemplates.filter((template) => template.tag === activeCategory)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#EEF0F4] bg-white px-4">
        <button
          type="button"
          onClick={() => onGoToSection('Templates')}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-[0.6875rem] font-medium text-[#17213A] shadow-sm hover:bg-slate-50"
        >
          <ChevronLeft size={13} strokeWidth={1.9} />
          Back to Templates
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[0.6875rem] font-medium text-[#17213A] hover:bg-slate-50">
            <Eye size={13} strokeWidth={1.9} /> Preview
          </button>
          <button type="button" onClick={onNewDiagram} className="inline-flex h-7 items-center gap-1 rounded-md bg-[#6336F1] px-3 text-[0.6875rem] font-semibold text-white shadow-sm hover:bg-[#5930DE]">
            <FileCode2 size={13} strokeWidth={1.9} /> Use This Template
          </button>
          <button type="button" aria-label="More template actions" className="flex h-7 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#17213A] hover:bg-slate-50">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </header>

      <main className="soft-scrollbar min-h-0 flex-1 overflow-auto bg-white px-4 pb-4 pt-4">
        <section className="grid grid-cols-[minmax(0,1fr)_16rem] gap-5 border-b border-[#EEF0F4] pb-4">
          <div className="pt-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xs font-semibold leading-none tracking-tight text-[#0F172A]">Vertical Swimlane – Basic Process</h1>
              <span className="inline-flex h-5 items-center rounded-md bg-[#E8F8F4] px-2 text-[0.625rem] font-semibold text-[#15803D]">Business Process</span>
            </div>
            <p className="mt-3 text-[0.6875rem] font-normal leading-5 text-[#64748B]">A basic vertical swimlane diagram for process visualization across departments or roles.</p>
            <div className="mt-4 flex items-center gap-2">
              <TemplateBadge icon={<GitFork size={12} />} label="Beginner Friendly" tone="green" />
              <TemplateBadge icon={<SlidersHorizontal size={12} />} label="Customizable" />
              <TemplateBadge icon={<Grid3X3 size={12} />} label="6 Lanes" />
              <TemplateBadge icon={<GitFork size={12} />} label="12+ Steps" />
            </div>
          </div>

          <aside className="rounded-lg border border-[#E7EAF0] bg-white px-3 py-2.5 shadow-[0_0.5rem_1.25rem_rgba(15,23,42,0.02)]">
            <MetaRow icon={<CalendarDays size={13} />} label="Category" value="Business Process" />
            <MetaRow icon={<CalendarDays size={13} />} label="Created" value="May 1, 2024" />
            <MetaRow icon={<ClockIcon />} label="Updated" value="May 10, 2024" />
            <MetaRow icon={<Eye size={13} />} label="Used" value="1.2k times" />
            <MetaRow icon={<Heart size={13} />} label="Likes" value="98" />
            <MetaRow icon={<GitFork size={13} />} label="Complexity" value={<span className="inline-flex items-center gap-1"><span className="inline-flex h-3.5 w-7 items-center justify-center rounded-full bg-[#E8F8F4]"><span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" /><span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#22C55E] opacity-40" /></span> Low</span>} />
          </aside>
        </section>

        <section className="pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="flex h-7 w-64 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 text-[#64748B]">
              <Search size={13} strokeWidth={1.9} />
              <input aria-label="Search in this template" placeholder="Search in this template..." className="min-w-0 flex-1 text-[#0F172A] outline-none placeholder:text-[#7B88A1]" style={{ fontSize: '0.6875rem', fontWeight: 500 }} />
            </label>
            <div className="flex flex-1 items-center gap-1.5">
              {filters.map((filter) => {
                const active = activeCategory === filter
                return (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveCategory(filter)}
                    className={`h-7 rounded-md border px-2 text-[0.625rem] font-medium transition ${active ? 'border-[#8B5CF6] bg-[#EEE9FF] text-[#6336F1] ring-1 ring-[#8B5CF6]' : 'border-[#E5E7EB] bg-white text-[#25314D] hover:border-[#C7B9FF] hover:bg-[#F8F5FF] hover:text-[#6336F1]'}`}
                  >
                    {filter}
                  </button>
                )
              })}
            </div>
            <button type="button" className="inline-flex h-7 min-w-[6.5rem] items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[0.625rem] font-medium text-[#25314D] hover:bg-slate-50">
              Most Popular <ChevronDown size={12} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-x-4 gap-y-4">
            {visibleTemplates.map((template) => <TemplateDetailCard key={template.title} template={template} />)}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#94A3B8]"><ChevronLeft size={13} /></button>
            {[1, 2, 3].map((page) => <button key={page} className={`flex h-7 w-7 items-center justify-center rounded-md text-[0.6875rem] font-medium ${page === 1 ? 'bg-[#EEE9FF] text-[#6336F1]' : 'text-[#25314D]'}`}>{page}</button>)}
            <span className="px-1.5 text-[0.6875rem] font-medium text-[#25314D]">...</span>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[0.6875rem] font-medium text-[#25314D]">8</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#25314D]"><ChevronLeft size={13} className="rotate-180" /></button>
          </div>
        </section>
      </main>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TemplateBadge({ icon, label, tone }: { icon: ReactNode; label: string; tone?: 'green' }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 text-[0.625rem] font-medium text-[#26324F]">
      <span className={tone === 'green' ? 'text-[#22C55E]' : 'text-[#53627F]'}>{icon}</span>
      {label}
    </span>
  )
}

function MetaRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1.5 py-px text-[0.6875rem] font-medium text-[#66738D]">
      <span className="text-[#66738D]">{icon}</span>
      <span>{label}</span>
      <span className="text-right text-[#42506C]">{value}</span>
    </div>
  )
}

type TemplateDetail = (typeof detailTemplates)[number]

function TemplateDetailCard({ template }: { template: TemplateDetail }) {
  return (
    <button type="button" className={`h-[16rem] overflow-hidden rounded-lg border bg-white text-left transition hover:border-[#C7B9FF] hover:shadow-[0_1rem_2rem_rgba(99,54,241,0.08)] ${'selected' in template && template.selected ? 'border-[#8B5CF6] ring-1 ring-[#8B5CF6]' : 'border-[#E7EAF0]'}`}>
      <WorkflowPreview template={template} />
      <div className="h-[5rem] overflow-hidden px-2.5 pb-2 pt-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <h2 className="min-h-4 text-[0.6875rem] font-semibold leading-4 tracking-tight text-[#0F172A]">{template.title}</h2>
          {'selected' in template && template.selected && <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-[#6336F1] text-[0.5625rem] font-bold text-white">✓</span>}
        </div>
        <p className="mt-1 h-7 text-[0.625rem] font-normal leading-[0.9375rem] text-[#64748B]">{template.description}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <CategoryPill label={template.tag} theme={template.theme} />
          <span className="inline-flex items-center gap-1 text-[0.5625rem] font-medium text-[#66738D]"><GitFork size={10} /> {template.uses}</span>
        </div>
      </div>
    </button>
  )
}

function CategoryPill({ label, theme }: { label: string; theme: string }) {
  const classes: Record<string, string> = {
    purple: 'bg-[#EEE9FF] text-[#6336F1]',
    green: 'bg-[#E8F8F4] text-[#0F766E]',
    red: 'bg-[#FFE8E8] text-[#EF4444]',
  }
  return <span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[0.5625rem] font-semibold ${classes[theme] ?? classes.purple}`}>{label}</span>
}

function WorkflowPreview({ template }: { template: TemplateDetail }) {
  const laneWidth = 100 / template.lanes.length
  return (
    <div className="relative h-[11rem] overflow-hidden border-b border-[#EEF0F4] bg-white">
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${template.lanes.length}, minmax(0, 1fr))` }}>
        {template.lanes.map((lane, index) => (
          <div key={lane} className="border-r border-[#E7EAF0] last:border-r-0">
            <div className="flex h-4 items-center justify-center text-[0.3125rem] font-bold uppercase tracking-[0.04em] text-[#415075]" style={{ backgroundColor: ['#F0E8FF', '#EAF2FF', '#E8F8F4', '#FFF0E6', '#F8E8F6'][index % 5] }}>{lane}</div>
          </div>
        ))}
      </div>
      <svg className="absolute inset-x-0 top-4 h-[10rem] w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {template.paths.map((path) => <path key={path} d={path} fill="none" stroke="#8290A9" strokeWidth="0.65" strokeLinecap="round" strokeLinejoin="round" />)}
        {template.paths.map((path) => {
          const match = path.match(/([0-9]+)$/)
          return match ? <circle key={`${path}-dot`} cx={Number(match[1])} cy="50" r="0" fill="none" /> : null
        })}
      </svg>
      <div className="absolute inset-x-0 top-4 h-[10rem]">
        {template.nodes.map(([label, x, y, variant]) => (
          <TemplatePreviewNode key={`${template.title}-${label}`} label={label} x={Number(x)} y={Number(y)} variant={String(variant)} laneWidth={laneWidth} />
        ))}
      </div>
    </div>
  )
}

function TemplatePreviewNode({ label, x, y, variant }: { label: string; x: number; y: number; variant: string; laneWidth: number }) {
  const base = 'absolute flex items-center justify-center text-center text-[0.3125rem] font-semibold leading-[0.375rem] shadow-[0_0.125rem_0.3125rem_rgba(15,23,42,0.08)]'
  const palette: Record<string, string> = {
    'pill-purple': 'bg-[#DDD3FF] text-[#4F46E5] rounded-sm',
    blue: 'bg-[#DBEAFE] text-[#31507C] rounded-sm',
    green: 'bg-[#CFF3E6] text-[#0F766E] rounded-sm',
    orange: 'bg-[#FED7AA] text-[#9A4A12] rounded-sm',
    pink: 'bg-[#FBCFE8] text-[#B91C5C] rounded-sm',
    diamond: 'bg-[#D7F2E8] text-[#0F766E] rotate-45 rounded-[0.1875rem]',
  }
  if (variant === 'diamond') {
    return <span className={`${base} ${palette[variant]} h-5 w-5`} style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%) rotate(45deg)' }}><span className="-rotate-45 scale-[0.82] whitespace-pre-line">{label}</span></span>
  }
  return <span className={`${base} ${palette[variant] ?? palette.blue} h-4 w-10 whitespace-pre-line`} style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>{label}</span>
}

function TrashPage({ onNewDiagram }: Pick<SidebarFeaturePagesProps, 'onNewDiagram'>) {
  return (
    <PageShell title="Trash" onNewDiagram={onNewDiagram}>
      <section className="rounded-lg border border-[#E7EAF0] bg-white p-4">
        <div className="mb-4 flex h-8 items-center gap-1.5 rounded-md bg-[#F8F5FF] px-2.5 text-[0.6875rem] font-medium text-[#64748B]"><CheckCircle2 size={13} className="text-[#6336F1]" />Items in trash will be permanently deleted after 30 days.</div>
        <table className="w-full border-collapse text-left text-[0.6875rem]">
          <thead className="text-[#64748B]"><tr><th className="w-8 py-2.5"><input type="checkbox" aria-label="Select all deleted diagrams" /></th><th className="py-2.5">Name</th><th className="py-2.5">Deleted By</th><th className="py-2.5">Deleted At</th><th className="py-2.5">Expires In</th><th className="py-2.5" /></tr></thead>
          <tbody>
            {deletedRows.map(([name, deletedAt, expires]) => <tr key={name} className="border-t border-[#EEF0F4]"><td className="py-3"><input type="checkbox" aria-label={`Select ${name}`} /></td><td className="font-semibold text-[#334155]">{name}</td><td className="text-[#64748B]">valahdyo</td><td className="text-[#64748B]">{deletedAt}</td><td className="text-[#64748B]">{expires}</td><td className="text-right text-[#64748B]">⋮</td></tr>)}
          </tbody>
        </table>
        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-2"><button disabled className="h-7 rounded-md border border-[#E5E7EB] px-3 text-[0.6875rem] font-semibold text-[#94A3B8]">Restore</button><button disabled className="h-7 rounded-md border border-red-200 bg-red-50 px-3 text-[0.6875rem] font-semibold text-red-400">Delete Permanently</button></div>
          <p className="text-[0.6875rem] font-medium text-[#64748B]">1-4 of 4</p>
        </div>
      </section>
    </PageShell>
  )
}

function ImportPage({ draft, importError, onDraftChange, onImportDraft, onNewDiagram }: Pick<SidebarFeaturePagesProps, 'draft' | 'importError' | 'onDraftChange' | 'onImportDraft' | 'onNewDiagram'>) {
  return (
    <PageShell title="Import" onNewDiagram={onNewDiagram}>
      <div className="mb-4 flex gap-6 border-b border-[#EEF0F4]"><span className="relative pb-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#6336F1]">From Mermaid<span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#6336F1]" /></span><span className="pb-2.5 text-[0.625rem] font-medium uppercase tracking-[0.05em] text-[#64748B]">From File</span></div>
      <p className="mb-4 text-[0.6875rem] font-normal text-[#64748B]">Import your Mermaid code or .mmd file to create a diagram.</p>
      <div className="grid min-h-[31rem] grid-cols-2 gap-4">
        <section className="flex flex-col rounded-lg border border-[#E7EAF0] bg-white p-3"><h2 className="mb-2 text-xs font-semibold tracking-tight text-[#0F172A]">Mermaid Code</h2><textarea value={draft.source} onChange={(event) => onDraftChange(event.target.value)} className="soft-scrollbar min-h-0 flex-1 resize-none rounded-md border border-[#E7EAF0] bg-[#FAFAFC] p-2.5 font-mono text-[0.6875rem] leading-5 text-[#334155] outline-none focus:border-[#C7B9FF]" /></section>
        <section className="rounded-lg border border-[#E7EAF0] bg-white p-3"><h2 className="mb-2 text-xs font-semibold tracking-tight text-[#0F172A]">Preview</h2><ActiveCanvasPreview className="h-[26rem]" /></section>
      </div>
      {importError && <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-[0.6875rem] font-medium text-orange-700">{importError}</div>}
      <div className="mt-4 flex items-center justify-between"><button type="button" className="text-[0.6875rem] font-semibold text-[#6336F1]">Try Example</button><button type="button" onClick={onImportDraft} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#6336F1] px-3 text-white shadow-sm"><Upload size={13} /><span className="text-[0.6875rem] font-bold tracking-tight">Import</span></button></div>
    </PageShell>
  )
}

type ExportFormat = 'png' | 'mermaid' | 'json'






function ExportCaptureSurface({ captureRef }: { captureRef: RefObject<HTMLDivElement | null> }) {
  const graph = useEditorStore((state) => state.graph)
  const bounds = useMemo(() => getDiagramBounds(graph), [graph])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 overflow-hidden bg-white" style={{ width: bounds.width, height: bounds.height, zIndex: -1 }}>
      <div ref={captureRef} className="h-full w-full bg-white">
        <SwimlaneCanvas readOnly viewportOverride={bounds.viewport} canvasHeightOverride={bounds.canvasHeight} />
      </div>
    </div>
  )
}

function ExportPage({ draft, onNewDiagram, onExportJson, onExportMermaid }: Pick<SidebarFeaturePagesProps, 'draft' | 'onNewDiagram' | 'onExportJson' | 'onExportMermaid'>) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png')
  const [isExporting, setIsExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)

  const handleExport = () => {
    if (selectedFormat === 'json') {
      onExportJson()
      return
    }
    if (selectedFormat === 'mermaid') {
      onExportMermaid()
      return
    }
    const element = exportRef.current
    if (!element) return
    setIsExporting(true)
    window.setTimeout(() => {
      const captureElement = exportRef.current
      if (!captureElement) {
        setIsExporting(false)
        return
      }
      const captureSurface = captureElement.parentElement as HTMLElement | null
      const previousZIndex = captureSurface?.style.zIndex
      if (captureSurface) captureSurface.style.zIndex = '2147483647'
      void downloadDiagramElementPng(captureElement, draft.name).finally(() => {
        if (captureSurface) captureSurface.style.zIndex = previousZIndex ?? '-1'
        setIsExporting(false)
      })
    }, 0)
  }

  return (
    <PageShell title="Export" onNewDiagram={onNewDiagram}>
      <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-xs font-semibold tracking-tight text-[#0F172A]">Choose export format</h2><p className="mt-1 text-[0.6875rem] font-normal text-[#64748B]">Exporting current diagram: <span className="font-semibold text-[#0F172A]">{draft.name}</span></p></div><span className="rounded-md bg-[#F8F5FF] px-2.5 py-1 text-[0.625rem] font-semibold text-[#6336F1]">Active draft</span></div>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <FormatCard active={selectedFormat === 'png'} icon={<FileImage size={18} />} title="PNG" description="Export as PNG image" onClick={() => setSelectedFormat('png')} />
        <FormatCard active={selectedFormat === 'mermaid'} icon={<Code2 size={18} />} title="Mermaid" description="Export Mermaid source" onClick={() => setSelectedFormat('mermaid')} />
        <FormatCard active={selectedFormat === 'json'} icon={<FileText size={18} />} title="JSON" description="Export editable project" onClick={() => setSelectedFormat('json')} />
      </div>
      <div className="grid grid-cols-[14rem_minmax(0,1fr)] gap-5 rounded-lg border border-[#E7EAF0] bg-white p-4">
        <section><h2 className="mb-3 text-xs font-semibold tracking-tight text-[#0F172A]">Options</h2><div className="mb-4 rounded-md border border-[#E7EAF0] bg-[#FAFAFC] p-2.5"><p className="text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Diagram</p><p className="mt-1 truncate text-xs font-semibold text-[#0F172A]">{draft.name}</p><p className="mt-1 text-[0.6875rem] font-normal text-[#64748B]">The export uses the active editor graph shown in preview.</p></div><OptionRow label="Scale" value="2x" /><OptionRow label="Background" value="White" /><label className="mt-3 flex items-center gap-2 text-[0.6875rem] text-[#64748B]"><input type="checkbox" /> Include Grid</label><label className="mt-2.5 flex items-center gap-2 text-[0.6875rem] text-[#64748B]"><input type="checkbox" defaultChecked /> Include Title</label></section>
        <section><h2 className="mb-3 text-xs font-semibold tracking-tight text-[#0F172A]">Preview</h2><ActiveCanvasPreview className="h-[32rem]" /><div className="mt-4 flex justify-end"><button type="button" onClick={handleExport} disabled={isExporting} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#6336F1] px-3 text-white shadow-sm disabled:cursor-wait disabled:opacity-70"><Download size={13} /><span className="text-[0.6875rem] font-bold tracking-tight">{isExporting ? 'Exporting...' : `Export ${selectedFormat.toUpperCase()}`}</span></button></div></section>
      </div>
      <ExportCaptureSurface captureRef={exportRef} />
    </PageShell>
  )
}

function FormatCard({ icon, title, description, active, onClick }: { icon: ReactNode; title: string; description: string; active?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex items-center gap-3 rounded-lg border bg-white p-3 text-left transition ${active ? 'border-[#8B5CF6] ring-1 ring-[#EEE9FF]' : 'border-[#E7EAF0] hover:border-[#C7B9FF] hover:bg-[#F8F5FF]'}`}><span className={active ? 'text-[#6336F1]' : 'text-[#64748B]'}>{icon}</span><span><span className="block text-xs font-semibold tracking-tight text-[#0F172A]">{title}</span><span className="text-[0.6875rem] font-normal text-[#64748B]">{description}</span></span></button>
}

function OptionRow({ label, value }: { label: string; value: string }) {
  return <label className="mb-3 flex items-center justify-between text-[0.6875rem] font-medium text-[#64748B]"><span>{label}</span><select className="h-7 w-24 rounded-md border border-[#E5E7EB] bg-white px-2 text-[#334155]" style={{ fontSize: '0.6875rem', fontWeight: 500 }}><option>{value}</option></select></label>
}

function SettingsPage({ onNewDiagram }: Pick<SidebarFeaturePagesProps, 'onNewDiagram'>) {
  const tabs = ['Profile', 'Workspace', 'Preferences', 'Appearance', 'Integrations', 'Billing', 'Team', 'Security']
  return (
    <PageShell title="Settings" onNewDiagram={onNewDiagram}>
      <div className="mb-3.5 flex flex-wrap gap-1.5 border-b border-[#EEF0F4] pb-2">{tabs.map((tab, index) => <span key={tab} className={`inline-flex h-7 items-center rounded-md px-2 text-[0.625rem] uppercase tracking-[0.04em] ${index === 0 ? 'border border-[#D9D6FE] bg-[#F8F5FF] font-bold text-[#6336F1]' : 'font-semibold text-[#334155]'}`}>{tab}</span>)}</div>
      <div className="grid grid-cols-4 items-start gap-3">
        <SettingsCard title="Profile Information" subtitle="Update your personal information"><Field label="Name" value="valahdyo" /><Field label="Email" value="valahdyo@example.com" /><Field label="Language" value="English" /><button className="mt-2.5 inline-flex h-6.5 w-fit items-center rounded-md bg-[#6336F1] px-2.5 text-white"><span className="text-[0.625rem] font-bold tracking-tight">Save Changes</span></button></SettingsCard>
        <SettingsCard title="Preferences" subtitle="Customize your experience"><ToggleRow label="Auto save" /><ToggleRow label="Show grid by default" /><ToggleRow label="Snap to grid" /><ToggleRow label="Show minimap" /></SettingsCard>
        <SettingsCard title="Appearance" subtitle="Customize the looks of the application"><div className="mb-2.5 grid grid-cols-3 gap-1.5"><button className="h-6.5 rounded-md border border-[#8B5CF6] bg-[#F8F5FF] text-[#6336F1]"><span className="text-[0.6875rem] font-bold tracking-tight">Light</span></button><button className="h-6.5 rounded-md border border-[#E5E7EB] text-[#475569]"><span className="text-[0.6875rem] font-semibold tracking-tight">Dark</span></button><button className="h-6.5 rounded-md border border-[#E5E7EB] text-[#475569]"><span className="text-[0.6875rem] font-semibold tracking-tight">System</span></button></div><p className="mb-1.5 text-[0.6875rem] font-semibold text-[#0F172A]">Primary Color</p><div className="flex gap-2">{['#6336F1','#06B6D4','#10B981','#22C55E','#FACC15','#FB923C','#EF4444','#F472B6','#CBD5E1'].map((color) => <span key={color} className="h-4 w-4 rounded-full border border-white ring-1 ring-[#E5E7EB]" style={{ backgroundColor: color }} />)}</div></SettingsCard>
        <SettingsCard title="About Varagraph" subtitle=""><div className="flex items-center gap-2"><VaragraphLogoMark size={26} /><span className="text-sm font-bold text-[#0F172A]">varagraph</span></div><p className="mt-3 text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Version 1.0.0</p><p className="mt-2 text-[0.6875rem] leading-5 text-[#64748B]">Varagraph is a web-based diagram editor that helps you create, visualize, and share diagrams effortlessly.</p><a className="mt-3 flex items-center gap-1.5 text-[0.6875rem] font-bold text-[#6336F1]">Documentation <ExternalLink size={11} /></a><a className="mt-2.5 flex items-center gap-1.5 text-[0.6875rem] font-bold text-[#6336F1]">Changelog <ExternalLink size={11} /></a></SettingsCard>
      </div>
    </PageShell>
  )
}

function SettingsCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="rounded-lg border border-[#E7EAF0] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><h2 className="text-xs font-bold tracking-tight text-[#0F172A]">{title}</h2>{subtitle && <p className="mt-1 text-[0.625rem] font-medium text-[#64748B]">{subtitle}</p>}<div className="mt-3 border-t border-[#F1F5F9] pt-3">{children}</div></section>
}

function Field({ label, value }: { label: string; value: string }) {
  return <label className="mb-2 grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2 text-[0.6875rem] font-semibold text-[#0F172A]"><span>{label}</span><input defaultValue={value} className="h-8 min-w-0 rounded-md border border-[#E5E7EB] px-2.5 text-[#0F172A] outline-none focus:border-[#8B5CF6]" style={{ fontSize: '0.6875rem', fontWeight: 500 }} /></label>
}

function ToggleRow({ label }: { label: string }) {
  return <div className="mb-2 flex items-center justify-between"><span className="text-[0.6875rem] font-semibold text-[#0F172A]">{label}</span><span className="flex h-5 w-9 items-center justify-end rounded-full bg-[#6336F1] p-px shadow-sm"><span className="h-4 w-4 rounded-full bg-white shadow" /></span></div>
}

export function SidebarFeaturePages(props: SidebarFeaturePagesProps) {
  if (props.activeSection === 'Dashboard') return <DashboardPage onNewDiagram={props.onNewDiagram} onGoToSection={props.onGoToSection} />
  if (props.activeSection === 'Templates') return <TemplatesPage onNewDiagram={props.onNewDiagram} onGoToSection={props.onGoToSection} />
  if (props.activeSection === 'Trash') return <TrashPage onNewDiagram={props.onNewDiagram} />
  if (props.activeSection === 'Import (Mermaid)') return <ImportPage draft={props.draft} importError={props.importError} onDraftChange={props.onDraftChange} onImportDraft={props.onImportDraft} onNewDiagram={props.onNewDiagram} />
  if (props.activeSection === 'Export') return <ExportPage draft={props.draft} onNewDiagram={props.onNewDiagram} onExportJson={props.onExportJson} onExportMermaid={props.onExportMermaid} />
  if (props.activeSection === 'Settings') return <SettingsPage onNewDiagram={props.onNewDiagram} />
  return null
}
