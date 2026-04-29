import { ChevronLeft, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { ReactNode } from 'react'

const swatches = ['#F0E8FF', '#EAF2FF', '#E8F8F4', '#FFF0E6', '#F8E8F6']

type InspectorPanelProps = {
  isCollapsed: boolean
  onToggle: () => void
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-[18px] w-[30px] items-center rounded-full p-[2px] ${checked ? 'justify-end bg-[#6336F1]' : 'justify-start bg-[#CBD5E1]'}`}>
      <span className="h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.16)]" />
    </span>
  )
}

function ColorField({ value }: { value: string }) {
  return (
    <div className="flex h-8 min-w-[92px] items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-2">
      <span className="h-4 w-4 rounded-[3px] border border-[#E5E7EB]" style={{ backgroundColor: value }} />
      <span className="text-[11px] font-medium text-[#334155]">{value}</span>
    </div>
  )
}

function SelectField({ value }: { value: string }) {
  return (
    <div className="flex h-8 min-w-[92px] items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-2 text-[11px] font-medium text-[#334155]">
      {value}
      <ChevronDown size={13} className="text-[#94A3B8]" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#EEF0F4] px-[14px] py-4 last:border-b-0">
      <h2 className="mb-4 text-[12px] font-bold leading-none text-[#0F172A]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium leading-[17px] text-[#334155]">{label}</span>
      {children}
    </div>
  )
}

export function InspectorPanel({ isCollapsed, onToggle }: InspectorPanelProps) {
  const showGrid = useEditorStore((state) => state.showGrid)
  const toggleGrid = useEditorStore((state) => state.toggleGrid)
  const selectedLaneId = useEditorStore((state) => state.selectedLaneId)
  const graph = useEditorStore((state) => state.graph)
  const updateLaneColor = useEditorStore((state) => state.updateLaneColor)
  const selectedLane = graph.lanes.find((lane) => lane.id === selectedLaneId) ?? graph.lanes[0]

  if (isCollapsed) {
    return (
      <aside className="flex w-[44px] shrink-0 flex-col items-center rounded-md border border-[#E7EAF0] bg-white py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand inspector panel"
          aria-expanded={false}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EEE9FF] text-[#6336F1] hover:bg-[#E6DFFF]"
        >
          <ChevronLeft size={16} />
        </button>
        <SlidersHorizontal size={16} className="mt-4 text-[#64748B]" />
        <div className="mt-4 flex flex-1 items-center justify-center">
          <p className="rotate-90 whitespace-nowrap text-[10px] font-semibold tracking-[0.14em] text-[#8A94A6]">STYLE</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-[226px] shrink-0 flex-col overflow-hidden rounded-md border border-[#E7EAF0] bg-white">
      <div className="relative flex h-[50px] shrink-0 border-b border-[#EEF0F4] px-4">
        <button type="button" className="relative flex flex-1 items-center justify-center text-[12px] font-medium text-[#6336F1]">
          Diagram
          <span className="absolute bottom-0 h-0.5 w-[82px] rounded-full bg-[#6336F1]" />
        </button>
        <button type="button" className="flex flex-1 items-center justify-center text-[12px] font-medium text-[#64748B]">
          Style
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse inspector panel"
          aria-expanded={true}
          className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-slate-50"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="soft-scrollbar min-h-0 flex-1 overflow-y-auto">
        <Section title="Canvas">
          <Row label="Background">
            <ColorField value="#FAFAFC" />
          </Row>
          <button type="button" onClick={toggleGrid} className="flex w-full items-center justify-between gap-3 text-left">
            <span className="text-[11px] font-medium text-[#334155]">Grid</span>
            <Toggle checked={showGrid} />
          </button>
          <Row label="Dot size">
            <SelectField value="Small" />
          </Row>
        </Section>

        <Section title="Swimlanes">
          <Row label="Header Background">
            <div className="flex shrink-0 items-center gap-[3px]">
              {swatches.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => selectedLane && updateLaneColor(selectedLane.id, color)}
                  className="h-[12px] w-[12px] rounded-[3px] border border-[#DDE3EC] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
                  style={{ backgroundColor: color }}
                  aria-label={`Set lane color ${color}`}
                />
              ))}
              <button type="button" className="h-[22px] w-[32px] rounded-[4px] border border-[#E5E7EB] bg-white text-[9px] font-medium leading-none text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                More
              </button>
            </div>
          </Row>
          <Row label="Header Text">
            <ColorField value="#374151" />
          </Row>
          <Row label="Lane Border">
            <ColorField value="#E5E7EB" />
          </Row>
        </Section>

        <Section title="Shapes">
          <Row label="Corner Radius">
            <SelectField value="12" />
          </Row>
          <Row label="Soft Shadows">
            <Toggle checked />
          </Row>
        </Section>

        <Section title="Text">
          <Row label="Font Family">
            <SelectField value="Inter" />
          </Row>
          <Row label="Font Size">
            <SelectField value="14" />
          </Row>
          <Row label="Text Color">
            <ColorField value="#374151" />
          </Row>
        </Section>
      </div>

      <div className="border-t border-[#EEF0F4] p-[13px]">
        <button type="button" className="h-9 w-full rounded-[5px] border border-[#8B5CF6] bg-white text-[12px] font-medium text-[#6336F1] hover:bg-[#F8F5FF]">
          Reset Style
        </button>
      </div>
    </aside>
  )
}
