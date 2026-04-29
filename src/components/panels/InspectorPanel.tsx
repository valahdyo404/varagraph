import { ChevronDown, ChevronLeft, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { DiagramEdgeArrow, DiagramNodeVariant } from '../../types/graph'
import type { ReactNode } from 'react'

const swatches = ['#F0E8FF', '#EAF2FF', '#E8F8F4', '#FFF0E6', '#F8E8F6']
const nodeSwatches = ['#F2E9FF', '#EEF4FF', '#EBF8F5', '#FFF1E8', '#FFFFFF']
const variants: Array<{ value: DiagramNodeVariant; label: string }> = [
  { value: 'process', label: 'Process' },
  { value: 'decision', label: 'Decision' },
  { value: 'startEnd', label: 'Start / End' },
  { value: 'inputOutput', label: 'Input / Output' },
  { value: 'annotation', label: 'Annotation' },
]
const arrowDirections: Array<{ value: DiagramEdgeArrow; label: string }> = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
]

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

function SelectField({ value, children, onChange }: { value: string; children: ReactNode; onChange: (value: string) => void }) {
  return (
    <label className="relative flex h-8 min-w-[112px] items-center rounded-md border border-[#E5E7EB] bg-white text-[11px] font-medium text-[#334155]">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-full w-full appearance-none rounded-md bg-transparent px-2 pr-6 outline-none">
        {children}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 text-[#94A3B8]" />
    </label>
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

function TextInput({ value, onChange, ariaLabel }: { value: string; onChange: (value: string) => void; ariaLabel: string }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel} className="h-8 min-w-0 flex-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-[11px] font-medium text-[#334155] outline-none focus:border-[#8B5CF6]" />
}

export function InspectorPanel({ isCollapsed, onToggle }: InspectorPanelProps) {
  const showGrid = useEditorStore((state) => state.showGrid)
  const toggleGrid = useEditorStore((state) => state.toggleGrid)
  const selectedLaneId = useEditorStore((state) => state.selectedLaneId)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId)
  const laneDeleteMessage = useEditorStore((state) => state.laneDeleteMessage)
  const laneDeleteTargetId = useEditorStore((state) => state.laneDeleteTargetId)
  const graph = useEditorStore((state) => state.graph)
  const updateLaneColor = useEditorStore((state) => state.updateLaneColor)
  const updateLaneTitle = useEditorStore((state) => state.updateLaneTitle)
  const deleteLane = useEditorStore((state) => state.deleteLane)
  const canDeleteLane = useEditorStore((state) => state.canDeleteLane)
  const updateNodeLabel = useEditorStore((state) => state.updateNodeLabel)
  const updateNodeVariant = useEditorStore((state) => state.updateNodeVariant)
  const updateNodeStyle = useEditorStore((state) => state.updateNodeStyle)
  const resetNodeStyle = useEditorStore((state) => state.resetNodeStyle)
  const moveNodeToLane = useEditorStore((state) => state.moveNodeToLane)
  const deleteNode = useEditorStore((state) => state.deleteNode)
  const updateEdgeLabel = useEditorStore((state) => state.updateEdgeLabel)
  const updateEdgeArrowDirection = useEditorStore((state) => state.updateEdgeArrowDirection)
  const reverseEdgeDirection = useEditorStore((state) => state.reverseEdgeDirection)
  const deleteEdge = useEditorStore((state) => state.deleteEdge)
  const pendingEdgeArrowDirection = useEditorStore((state) => state.pendingEdgeArrowDirection)
  const setPendingEdgeArrowDirection = useEditorStore((state) => state.setPendingEdgeArrowDirection)
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId)
  const selectedLane = graph.lanes.find((lane) => lane.id === selectedLaneId) ?? (selectedNode ? graph.lanes.find((lane) => lane.id === selectedNode.data.laneId) : undefined)

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
          <Row label="New edge">
            <SelectField value={pendingEdgeArrowDirection} onChange={(value) => setPendingEdgeArrowDirection(value as DiagramEdgeArrow)}>
              {arrowDirections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </SelectField>
          </Row>
        </Section>

        {selectedNode && (
          <Section title="Selected Node">
            <Row label="Label">
              <TextInput value={selectedNode.data.label} onChange={(value) => updateNodeLabel(selectedNode.id, value)} ariaLabel="Node label" />
            </Row>
            <Row label="Type">
              <SelectField value={selectedNode.data.variant} onChange={(value) => updateNodeVariant(selectedNode.id, value as DiagramNodeVariant)}>
                {variants.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </SelectField>
            </Row>
            <Row label="Lane">
              <SelectField value={selectedNode.data.laneId} onChange={(value) => moveNodeToLane(selectedNode.id, value)}>
                {graph.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}
              </SelectField>
            </Row>
            <Row label="Fill">
              <div className="flex shrink-0 items-center gap-[3px]">
                {nodeSwatches.map((color) => (
                  <button key={color} type="button" onClick={() => updateNodeStyle(selectedNode.id, { backgroundColor: color })} className="h-[12px] w-[12px] rounded-[3px] border border-[#DDE3EC]" style={{ backgroundColor: color }} aria-label={`Set node fill ${color}`} />
                ))}
              </div>
            </Row>
            <button type="button" onClick={() => deleteNode(selectedNode.id)} className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 text-[11px] font-semibold text-red-600 hover:bg-red-100">
              <Trash2 size={13} /> Delete node
            </button>
          </Section>
        )}

        {selectedEdge && (
          <Section title="Selected Edge">
            <Row label="Label">
              <TextInput value={selectedEdge.label ?? ''} onChange={(value) => updateEdgeLabel(selectedEdge.id, value)} ariaLabel="Edge label" />
            </Row>
            <Row label="Arrow">
              <SelectField value={selectedEdge.data?.arrowDirection ?? 'forward'} onChange={(value) => updateEdgeArrowDirection(selectedEdge.id, value as DiagramEdgeArrow)}>
                {arrowDirections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </SelectField>
            </Row>
            <button type="button" onClick={() => reverseEdgeDirection(selectedEdge.id)} className="h-8 w-full rounded-md border border-[#E5E7EB] bg-white text-[11px] font-semibold text-[#334155] hover:bg-slate-50">
              Reverse source and target
            </button>
            <button type="button" onClick={() => deleteEdge(selectedEdge.id)} className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 text-[11px] font-semibold text-red-600 hover:bg-red-100">
              <Trash2 size={13} /> Delete edge
            </button>
          </Section>
        )}

        <Section title="Swimlanes">
          {selectedLane ? (
            <>
              <Row label="Title">
                <TextInput value={selectedLane.title} onChange={(value) => updateLaneTitle(selectedLane.id, value)} ariaLabel="Lane title" />
              </Row>
              <Row label="Header Background">
                <div className="flex shrink-0 items-center gap-[3px]">
                  {swatches.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateLaneColor(selectedLane.id, color)}
                      className="h-[12px] w-[12px] rounded-[3px] border border-[#DDE3EC] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
                      style={{ backgroundColor: color }}
                      aria-label={`Set lane color ${color}`}
                    />
                  ))}
                </div>
              </Row>
              <button type="button" onClick={() => deleteLane(selectedLane.id)} className={`flex h-8 w-full items-center justify-center gap-2 rounded-md border border-[#E5E7EB] bg-white text-[11px] font-semibold hover:bg-slate-50 ${canDeleteLane(selectedLane.id) ? 'text-[#334155]' : 'text-[#94A3B8]'}`}>
                <Trash2 size={13} /> Delete lane
              </button>
              {laneDeleteMessage && laneDeleteTargetId === selectedLane.id && <p className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[11px] font-medium leading-4 text-orange-700">{laneDeleteMessage}</p>}
            </>
          ) : (
            <p className="text-[11px] leading-5 text-[#64748B]">Select a lane header, node, or edge to edit its properties.</p>
          )}
        </Section>

        <Section title="Text">
          <Row label="Font Family">
            <ColorField value="Inter" />
          </Row>
          <Row label="Text Color">
            <ColorField value="#374151" />
          </Row>
        </Section>
      </div>

      <div className="border-t border-[#EEF0F4] p-[13px]">
        <button type="button" onClick={() => selectedNode && resetNodeStyle(selectedNode.id)} disabled={!selectedNode} className="h-9 w-full rounded-[5px] border border-[#8B5CF6] bg-white text-[12px] font-medium text-[#6336F1] hover:bg-[#F8F5FF] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#94A3B8]">
          Reset Style
        </button>
      </div>
    </aside>
  )
}
