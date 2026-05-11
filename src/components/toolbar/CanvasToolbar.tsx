import { ArrowRight, Circle, Diamond, Grip, Hand, Minus, MousePointer2, MoveDiagonal2, Square, Type, Workflow } from 'lucide-react'
import type { DiagramEdgeArrow } from '../../types/graph'
import { useEditorStore } from '../../store/editorStore'

export type CanvasTool = 'Select' | 'Pan' | 'Connector' | 'Process' | 'Decision' | 'Text' | 'Start' | 'InputOutput'

const tools = [
  { label: 'Select', tool: 'Select', icon: MousePointer2, enabled: true, group: 0 },
  { label: 'Pan', tool: 'Pan', icon: Hand, enabled: true, group: 1 },
  { label: 'Connector', tool: 'Connector', icon: MoveDiagonal2, enabled: true, group: 1 },
  { label: 'Text', tool: 'Text', icon: Type, enabled: true, group: 2 },
  { label: 'Input/Output', tool: 'InputOutput', icon: Workflow, enabled: true, group: 2 },
  { label: 'Decision', tool: 'Decision', icon: Diamond, enabled: true, group: 2 },
  { label: 'Rectangle', tool: 'Process', icon: Square, enabled: true, group: 2 },
  { label: 'Circle', tool: 'Start', icon: Circle, enabled: true, group: 2 },
] as const

const edgeStyles: Array<{ label: string; title: string; arrowDirection: DiagramEdgeArrow; icon: typeof ArrowRight }> = [
  { label: 'Arrow', title: 'New connectors use arrowheads', arrowDirection: 'forward', icon: ArrowRight },
  { label: 'Line', title: 'New connectors use plain lines', arrowDirection: 'none', icon: Minus },
]

const readOnlyAllowedTools = new Set<CanvasTool>(['Select', 'Pan'])

export function CanvasToolbar({ readOnly = false }: { readOnly?: boolean } = {}) {
  const activeTool = useEditorStore((state) => state.activeTool)
  const onToolChange = useEditorStore((state) => state.setActiveTool)
  const pendingEdgeArrowDirection = useEditorStore((state) => state.pendingEdgeArrowDirection)
  const setPendingEdgeArrowDirection = useEditorStore((state) => state.setPendingEdgeArrowDirection)

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 items-center rounded-md border border-[#EEF0F4] bg-white px-1 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
        {tools.map((toolConfig, index) => {
          const { label, tool, icon: Icon, enabled, group } = toolConfig
          const toolEnabled = enabled && (!readOnly || readOnlyAllowedTools.has(tool))
          const active = toolEnabled && activeTool === tool
          const previous = tools[index - 1]
          const addDivider = previous && previous.group !== group

          return (
            <div key={label} className="flex items-center">
              {addDivider && <div className="mx-2 h-5 w-px bg-[#EEF0F4]" />}
              <button
                type="button"
                aria-label={label === 'Connector' ? 'Connector tool' : label}
                onClick={() => {
                  if (!toolEnabled) return
                  onToolChange(tool)
                }}
                disabled={!toolEnabled}
                aria-pressed={active}
                title={readOnly ? 'Disabled in read-only view' : label === 'Connector' ? 'Connector tool' : toolEnabled ? label : `${label} is controlled from Connector/Inspector`}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
                  active
                    ? 'bg-[#EEE9FF] text-[#6336F1]'
                    : toolEnabled
                      ? 'text-[#0F172A] hover:bg-slate-50'
                      : 'cursor-not-allowed text-[#9AA4B5]'
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
              </button>
            </div>
          )
        })}
        <div className="mx-2 h-5 w-px bg-[#EEF0F4]" />
        {edgeStyles.map(({ label, title, arrowDirection, icon: Icon }) => {
          const active = !readOnly && pendingEdgeArrowDirection === arrowDirection
          return (
            <button
              key={label}
              type="button"
              aria-label={`Edge style ${label}`}
              aria-pressed={active}
              title={readOnly ? 'Disabled in read-only view' : title}
              disabled={readOnly}
              onClick={() => !readOnly && setPendingEdgeArrowDirection(arrowDirection)}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition ${active ? 'bg-[#EEE9FF] text-[#6336F1]' : readOnly ? 'cursor-not-allowed text-[#9AA4B5]' : 'text-[#0F172A] hover:bg-slate-50'}`}
            >
              <Icon size={17} strokeWidth={1.8} />
            </button>
          )
        })}
      </div>
      <button type="button" aria-label="Add process node" disabled={readOnly} onClick={() => !readOnly && onToolChange('Process')} className={`flex h-10 w-10 items-center justify-center rounded-md border border-[#EEF0F4] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.03)] ${readOnly ? 'cursor-not-allowed text-[#9AA4B5]' : 'text-[#0F172A] hover:bg-slate-50'}`}>
        <Grip size={18} />
      </button>
    </div>
  )
}
