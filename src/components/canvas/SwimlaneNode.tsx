import { useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { AlertCircle, Clipboard, Database, PlayCircle, Power, RefreshCw, ShieldCheck, Trophy, Workflow } from 'lucide-react'
import type { DiagramNodeData } from '../../types/graph'
import { nodeWidth } from '../../lib/graph/autoLayout'
import { useEditorStore } from '../../store/editorStore'

export const SWIMLANE_NODE_WIDTH = nodeWidth

const variantStyle = {
  startEnd: 'rounded-full',
  process: 'rounded-2xl',
  decision: 'rounded-[0.35rem] rotate-45',
  subProcess: 'rounded-2xl border-double',
  inputOutput: 'rounded-2xl skew-x-[-8deg]',
  annotation: 'rounded-2xl border-dashed',
}

const variantIcon = {
  startEnd: PlayCircle,
  process: Workflow,
  decision: ShieldCheck,
  subProcess: Clipboard,
  inputOutput: Workflow,
  annotation: AlertCircle,
}

const laneNodeColors: Record<string, { bg: string; border: string; icon: string; iconBg: string }> = {
  'lane-1': { bg: '#F2E9FF', border: '#DCCBFF', icon: '#6336F1', iconBg: '#F6F0FF' },
  'lane-2': { bg: '#EEF4FF', border: '#C9DDFB', icon: '#3882F6', iconBg: '#EFF6FF' },
  'lane-3': { bg: '#EBF8F5', border: '#CFEDE6', icon: '#0F9F8A', iconBg: '#ECFDF8' },
  'lane-4': { bg: '#FFF1E8', border: '#FFD5BF', icon: '#FB6A3C', iconBg: '#FFF7ED' },
  'lane-5': { bg: '#F8E8F6', border: '#EAD0E7', icon: '#6336F1', iconBg: '#FAF0FF' },
  A: { bg: '#F2E9FF', border: '#DCCBFF', icon: '#6336F1', iconBg: '#F6F0FF' },
  B: { bg: '#EEF4FF', border: '#C9DDFB', icon: '#3882F6', iconBg: '#EFF6FF' },
  C: { bg: '#EBF8F5', border: '#CFEDE6', icon: '#0F9F8A', iconBg: '#ECFDF8' },
  D: { bg: '#FFF1E8', border: '#FFD5BF', icon: '#FB6A3C', iconBg: '#FFF7ED' },
  E: { bg: '#F8E8F6', border: '#EAD0E7', icon: '#6336F1', iconBg: '#FAF0FF' },
}

const iconForLabel = (label: string, fallback: typeof Workflow) => {
  if (/process input/i.test(label)) return Database
  if (/validate/i.test(label)) return ShieldCheck
  if (/complete/i.test(label)) return Trophy
  if (/terminate/i.test(label)) return Power
  if (/retry/i.test(label)) return RefreshCw
  if (/exception/i.test(label)) return AlertCircle
  if (/initialize|finalize/i.test(label)) return Clipboard
  return fallback
}

export function SwimlaneNode({ id, data, selected }: NodeProps) {
  const nodeData = data as DiagramNodeData
  const updateNodeLabel = useEditorStore((state) => state.updateNodeLabel)
  const [isEditing, setIsEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(nodeData.label)
  const laneStyle = laneNodeColors[nodeData.laneId] ?? laneNodeColors['lane-3']
  const Icon = iconForLabel(nodeData.label, variantIcon[nodeData.variant])
  const backgroundColor = nodeData.style?.backgroundColor ?? (nodeData.variant === 'decision' ? '#E8F8F4' : laneStyle.bg)
  const borderColor = nodeData.style?.borderColor ?? (selected ? '#8B5CF6' : nodeData.variant === 'decision' ? '#CFEDE6' : laneStyle.border)
  const textColor = nodeData.style?.textColor ?? '#0F172A'
  const contentClass = nodeData.variant === 'decision' ? '-rotate-45' : nodeData.variant === 'inputOutput' ? 'skew-x-[8deg]' : ''
  const isDecision = nodeData.variant === 'decision'
  const targetGap = nodeData.variant === 'decision' ? 14 : 10

  const commitLabel = () => {
    updateNodeLabel(String(id), draftLabel)
    setIsEditing(false)
  }

  return (
    <div className="relative" style={{ width: SWIMLANE_NODE_WIDTH }}>
      <Handle id="left-target" type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle id="top-target" type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle
        id="left-gap-target"
        type="target"
        position={Position.Left}
        className="!h-1 !w-1 !border-0 !bg-transparent"
        style={{ left: -targetGap }}
      />
      <Handle
        id="top-gap-target"
        type="target"
        position={Position.Top}
        className="!h-1 !w-1 !border-0 !bg-transparent"
        style={{ top: -targetGap }}
      />
      <Handle
        id="bottom-gap-target"
        type="target"
        position={Position.Bottom}
        className="!h-1 !w-1 !border-0 !bg-transparent"
        style={{ bottom: -targetGap }}
      />
      <div className={isDecision ? 'flex justify-center py-2' : ''}>
        <div
          onDoubleClick={(event) => {
            event.stopPropagation()
            setDraftLabel(nodeData.label)
            setIsEditing(true)
          }}
          className={`border shadow-[0_8px_18px_rgba(15,23,42,0.035)] transition ${variantStyle[nodeData.variant]} ${
            isDecision ? 'flex h-[108px] items-center justify-center px-4 py-3' : 'min-h-[62px] px-4 py-3'
          } ${selected ? 'ring-4 ring-[#6B46F2]/18' : ''}`}
          style={{ width: isDecision ? 108 : SWIMLANE_NODE_WIDTH, backgroundColor, borderColor, color: textColor }}
        >
          <div className={`flex items-center gap-2 ${contentClass}`}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: laneStyle.iconBg, color: laneStyle.icon }}>
              <Icon size={14} strokeWidth={1.9} />
            </span>
            {isEditing ? (
              <input
                autoFocus
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                onBlur={commitLabel}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitLabel()
                  if (event.key === 'Escape') setIsEditing(false)
                }}
                className="nodrag min-w-0 flex-1 rounded border border-[#C7B9FF] bg-white/90 px-1 text-[12px] font-medium leading-4 text-[#0F172A] outline-none"
                aria-label="Edit node label"
              />
            ) : (
              <span className="line-clamp-3 text-[12px] font-medium leading-4 tracking-normal">{nodeData.label}</span>
            )}
          </div>
        </div>
      </div>
      <Handle id="right-source" type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle id="left-source" type="source" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle id="top-source" type="source" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle id="right-target" type="target" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle
        id="right-gap-target"
        type="target"
        position={Position.Right}
        className="!h-1 !w-1 !border-0 !bg-transparent"
        style={{ right: -targetGap }}
      />
    </div>
  )
}
