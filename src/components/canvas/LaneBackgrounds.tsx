import { ClipboardCheck, Flag, Rocket, Settings2, TriangleAlert } from 'lucide-react'
import type { Swimlane } from '../../types/graph'

const laneIcons = [Rocket, ClipboardCheck, Settings2, TriangleAlert, Flag]

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
}

export function LaneBackgrounds({ lanes, height, selectedLaneId, isPanMode, onSelectLane }: LaneBackgroundsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {lanes.map((lane, index) => {
        const selected = lane.id === selectedLaneId
        const Icon = laneIcons[index % laneIcons.length]

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
              className={`${isPanMode ? 'pointer-events-none' : 'pointer-events-auto'} flex h-[78px] w-full items-center justify-center gap-3 border-b border-r border-[#E5E7EB] px-4 text-center text-[13px] font-medium leading-[17px] text-[#0F172A] transition hover:brightness-[0.99] ${
                index === 0 ? 'rounded-tl-md' : ''
              } ${index === lanes.length - 1 ? 'rounded-tr-md' : ''} ${
                selected ? 'ring-2 ring-inset ring-[#8B5CF6]/35' : ''
              }`}
              style={{ backgroundColor: lane.color }}
            >
              <Icon
                size={22}
                strokeWidth={1.8}
                className={
                  index === 0
                    ? 'text-[#6336F1]'
                    : index === 1
                      ? 'text-[#3882F6]'
                      : index === 2
                        ? 'text-[#0F9F8A]'
                        : index === 3
                          ? 'text-[#FB6A3C]'
                          : 'text-[#6336F1]'
                }
              />
              <span>{lane.title}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
