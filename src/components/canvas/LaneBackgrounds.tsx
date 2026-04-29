import { ClipboardCheck, Flag, Plus, Rocket, Settings2, Trash2, TriangleAlert } from 'lucide-react'
import type { LaneIcon, Swimlane } from '../../types/graph'

const defaultLaneIcons: LaneIcon[] = ['rocket', 'clipboard', 'settings', 'alert', 'flag']
const laneIconComponents = {
  rocket: Rocket,
  clipboard: ClipboardCheck,
  settings: Settings2,
  alert: TriangleAlert,
  flag: Flag,
} as const

const laneIconColor = (icon: LaneIcon | undefined, index: number) => {
  if (icon === 'rocket' || (!icon && index === 0)) return 'text-[#6336F1]'
  if (icon === 'clipboard' || (!icon && index === 1)) return 'text-[#3882F6]'
  if (icon === 'settings' || (!icon && index === 2)) return 'text-[#0F9F8A]'
  if (icon === 'alert' || (!icon && index === 3)) return 'text-[#FB6A3C]'
  return 'text-[#6336F1]'
}

type LaneBackgroundsProps = {
  lanes: Swimlane[]
  height: number
  selectedLaneId: string | null
  nodeCountsByLane: Map<string, number>
  canDeleteLane: (laneId: string) => boolean
  isPanMode: boolean
  onSelectLane: (laneId: string) => void
  onAddLane: () => void
  onDeleteLane: (laneId: string) => void
  laneDeleteMessage?: string | null
  laneDeleteTargetId?: string | null
}

export function LaneBackgrounds({ lanes, height, selectedLaneId, nodeCountsByLane, canDeleteLane, isPanMode, onSelectLane, onAddLane, onDeleteLane, laneDeleteMessage, laneDeleteTargetId }: LaneBackgroundsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {lanes.map((lane, index) => {
        const selected = lane.id === selectedLaneId
        const icon = lane.icon ?? defaultLaneIcons[index % defaultLaneIcons.length]
        const Icon = icon === 'none' ? null : laneIconComponents[icon]
        const nodeCount = nodeCountsByLane.get(lane.id) ?? 0

        return (
          <div
            key={lane.id}
            className="absolute top-0"
            style={{ left: lane.x, width: lane.width, minHeight: height }}
          >
            <div className="varagraph-lane-grid absolute inset-0 -z-10 border-r border-[#E5E7EB]" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelectLane(lane.id)
              }}
              className={`${isPanMode ? 'pointer-events-none' : 'pointer-events-auto'} group flex h-[78px] w-full items-center justify-center gap-3 border-b border-r border-[#E5E7EB] px-4 text-center text-[13px] font-medium leading-[17px] text-[#0F172A] transition hover:brightness-[0.99] ${
                index === 0 ? 'rounded-tl-md' : ''
              } ${index === lanes.length - 1 ? 'rounded-tr-md' : ''} ${
                selected ? 'ring-2 ring-inset ring-[#8B5CF6]/35' : ''
              }`}
              style={{ backgroundColor: lane.color }}
            >
              {Icon && <Icon size={22} strokeWidth={1.8} className={laneIconColor(lane.icon, index)} />}
              <span>{lane.title}</span>
              <span className="absolute bottom-2 right-2 rounded-full bg-white/70 px-1.5 text-[9px] font-semibold text-[#64748B]">{nodeCount}</span>
            </button>
            {laneDeleteMessage && laneDeleteTargetId === lane.id && (
              <div className="pointer-events-none absolute left-2 right-2 top-[84px] z-20 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[11px] font-semibold leading-4 text-orange-700 shadow-sm">
                {laneDeleteMessage}
              </div>
            )}
            {selected && !isPanMode && (
              <div className={`pointer-events-auto absolute right-2 ${laneDeleteMessage && laneDeleteTargetId === lane.id ? 'top-[128px]' : 'top-[84px]'} z-20 flex gap-1`}>
                <button type="button" onClick={(event) => { event.stopPropagation(); onAddLane() }} aria-label="Add lane" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#6336F1] shadow-sm hover:bg-[#F8F5FF]">
                  <Plus size={13} />
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteLane(lane.id) }} aria-label="Delete lane" title={canDeleteLane(lane.id) ? 'Delete lane' : 'Move nodes before deleting'} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] shadow-sm hover:bg-slate-50">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
