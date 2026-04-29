import { ArrowRight, Circle, Diamond, Grip, Hand, Minus, MousePointer2, MoveDiagonal2, Square, Type, Workflow } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'

export type CanvasTool = 'Select' | 'Pan' | 'Connector' | 'Process' | 'Decision' | 'Text' | 'Start' | 'InputOutput'

const tools = [
  { label: 'Select', tool: 'Select', icon: MousePointer2, enabled: true, group: 0 },
  { label: 'Pan', tool: 'Pan', icon: Hand, enabled: true, group: 1 },
  { label: 'Connector', tool: 'Connector', icon: MoveDiagonal2, enabled: true, group: 1 },
  { label: 'Arrow', tool: 'Connector', icon: ArrowRight, enabled: false, group: 1 },
  { label: 'Text', tool: 'Text', icon: Type, enabled: true, group: 2 },
  { label: 'Input/Output', tool: 'InputOutput', icon: Workflow, enabled: true, group: 2 },
  { label: 'Decision', tool: 'Decision', icon: Diamond, enabled: true, group: 2 },
  { label: 'Rectangle', tool: 'Process', icon: Square, enabled: true, group: 2 },
  { label: 'Circle', tool: 'Start', icon: Circle, enabled: true, group: 2 },
  { label: 'Line', tool: 'Connector', icon: Minus, enabled: false, group: 2 },
] as const

export function CanvasToolbar() {
  const activeTool = useEditorStore((state) => state.activeTool)
  const onToolChange = useEditorStore((state) => state.setActiveTool)

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 items-center rounded-md border border-[#EEF0F4] bg-white px-1 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
        {tools.map(({ label, tool, icon: Icon, enabled, group }, index) => {
          const active = enabled && activeTool === tool
          const previous = tools[index - 1]
          const addDivider = previous && previous.group !== group

          return (
            <div key={label} className="flex items-center">
              {addDivider && <div className="mx-2 h-5 w-px bg-[#EEF0F4]" />}
              <button
                type="button"
                aria-label={label}
                onClick={() => enabled && onToolChange(tool)}
                disabled={!enabled}
                title={enabled ? label : `${label} is controlled from Connector/Inspector`}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
                  active
                    ? 'bg-[#EEE9FF] text-[#6336F1]'
                    : enabled
                      ? 'text-[#0F172A] hover:bg-slate-50'
                      : 'cursor-not-allowed text-[#0F172A]'
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" aria-label="Add process node" onClick={() => onToolChange('Process')} className="flex h-10 w-10 items-center justify-center rounded-md border border-[#EEF0F4] bg-white text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.03)] hover:bg-slate-50">
        <Grip size={18} />
      </button>
    </div>
  )
}
