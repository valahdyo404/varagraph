import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MarkerType,
  PanOnScrollMode,
  ReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import type { DiagramEdgeArrow, DiagramNode, DiagramNodeData, DiagramNodeVariant } from '../../types/graph'
import { useEditorStore } from '../../store/editorStore'
import { LaneBackgrounds } from './LaneBackgrounds'
import { estimateNodeHeight, nodeWidth } from '../../lib/graph/autoLayout'
import {
  anchorForDirection,
  buildOrthogonalRoute,
  directionFromHandle,
  inferEdgeHandles,
  isLateralCrossLane,
  lateralSideTargetCorridorIsBlocked,
  maxOutgoingEdgesForSource,
  preferRouteAxis,
  resolveEdgeHandles,
  simplifyOrthogonalPoints,
  type AnchorDirection,
  type OrthogonalRoute,
  type RouteBounds,
  type RoutePoint,
} from '../../lib/graph/orthogonalRouting'
import { SwimlaneNode } from './SwimlaneNode'

const nodeTypes = { diagramNode: SwimlaneNode }

type SharedMarkerData = {
  colors: string[]
}

type SmartEdgeData = {
  route?: OrthogonalRoute
  labelPoint?: RoutePoint
  sharedStartMarker?: SharedMarkerData
  sharedEndMarker?: SharedMarkerData
}

const decisionSize = 108
const decisionOffsetX = (nodeWidth - decisionSize) / 2
const decisionOffsetY = 8
const decisionVisualRadius = (Math.sqrt(2) * decisionSize) / 2
const cornerRadius = 10
const edgeOffsetStep = 9
const edgeColors = ['#64748B', '#3882F6', '#0F9F8A', '#FB6A3C', '#8B5CF6', '#EC4899']
const maxSmartRoutingNodes = 150
const maxSmartRoutingEdges = 300

const getPathMidpoint = (points: RoutePoint[]): RoutePoint => {
  const fallback = points[0] ?? { x: 0, y: 0 }
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index]
    return {
      from: previous,
      to: point,
      length: Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y),
    }
  })
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0)
  if (totalLength === 0) return fallback

  let distance = totalLength / 2
  for (const segment of segments) {
    if (distance > segment.length) {
      distance -= segment.length
      continue
    }

    const ratio = segment.length === 0 ? 0 : distance / segment.length
    return {
      x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
      y: segment.from.y + (segment.to.y - segment.from.y) * ratio,
    }
  }

  return points.at(-1) ?? fallback
}

const decisionLabelPoint = (points: RoutePoint[], sourceDirection?: AnchorDirection): RoutePoint | undefined => {
  const source = points[0]
  const next = points[1]
  if (!source || !next) return undefined

  const dx = next.x - source.x
  const dy = next.y - source.y
  const horizontal = sourceDirection ? sourceDirection === 'left' || sourceDirection === 'right' : Math.abs(dx) >= Math.abs(dy)
  const direction = sourceDirection === 'left' || sourceDirection === 'top' ? -1 : 1
  const distance = Math.min(Math.max(Math.abs(horizontal ? dx : dy) * 0.45, 28), 56)
  const x = source.x + (horizontal ? direction * distance : 0)
  const y = source.y + (horizontal ? 0 : direction * distance)

  return horizontal ? { x, y: y - 14 } : { x: x - 18, y }
}

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1)

const shapeBoundsForNode = (node: DiagramNode): RouteBounds => {
  if (node.data.variant === 'decision') {
    const left = node.position.x + decisionOffsetX
    const top = node.position.y + decisionOffsetY
    const center = { x: left + decisionSize / 2, y: top + decisionSize / 2 }
    return {
      center,
      left: center.x - decisionVisualRadius,
      right: center.x + decisionVisualRadius,
      top: center.y - decisionVisualRadius,
      bottom: center.y + decisionVisualRadius,
    }
  }

  const height = estimateNodeHeight(node)
  const center = { x: node.position.x + nodeWidth / 2, y: node.position.y + height / 2 }
  return {
    center,
    left: node.position.x,
    right: node.position.x + nodeWidth,
    top: node.position.y,
    bottom: node.position.y + height,
  }
}

const buildSmartRoute = (
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  allNodes: DiagramNode[],
  offset = 0,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): OrthogonalRoute => {
  const sourceBounds = shapeBoundsForNode(sourceNode)
  const targetBounds = shapeBoundsForNode(targetNode)
  const blockedBounds = allNodes.filter((node) => node.id !== sourceNode.id && node.id !== targetNode.id).map(shapeBoundsForNode)
  const dx = targetBounds.center.x - sourceBounds.center.x
  const dy = targetBounds.center.y - sourceBounds.center.y
  const routeVertically = Math.abs(dy) > Math.abs(dx)
  const sameLane = sourceNode.data.laneId === targetNode.data.laneId
  const sourceDirection = directionFromHandle(sourceHandle) ?? (routeVertically ? (dy >= 0 ? 'bottom' : 'top') : dx >= 0 ? 'right' : 'left')
  const targetDirection = directionFromHandle(targetHandle) ?? (routeVertically ? (dy >= 0 ? 'top' : 'bottom') : dx >= 0 ? 'left' : 'right')
  const isDecisionCrossLane = sourceNode.data.variant === 'decision' && !sameLane
  const prefersLateralCrossLane = isLateralCrossLane(sourceBounds, targetBounds, sameLane)

  if (isDecisionCrossLane) {
    return buildOrthogonalRoute({
      sourceBounds,
      targetBounds,
      blockedBounds,
      sourceDirection,
      targetDirection,
      offset,
      prefer: 'horizontal',
    })
  }

  if (prefersLateralCrossLane) {
    return buildOrthogonalRoute({
      sourceBounds,
      targetBounds,
      blockedBounds,
      sourceDirection,
      targetDirection,
      offset,
      prefer: 'horizontal',
    })
  }

  const isIncomingDecision = targetNode.data.variant === 'decision' && sourceNode.data.variant !== 'decision' && Math.abs(dy) > 0.5

  if (isIncomingDecision) {
    return buildOrthogonalRoute({
      sourceBounds,
      targetBounds,
      blockedBounds,
      sourceDirection,
      targetDirection,
      offset,
      prefer: preferRouteAxis(sourceDirection, targetDirection),
    })
  }

  return buildOrthogonalRoute({
    sourceBounds,
    targetBounds,
    blockedBounds,
    sourceDirection,
    targetDirection,
    offset,
    prefer: preferRouteAxis(sourceDirection, targetDirection),
  })
}

const routeSegmentKeys = (points: RoutePoint[]): string[] => {
  const minimumSegmentLength = 24
  const simplified = simplifyOrthogonalPoints(points)

  return simplified.slice(1).flatMap((point, index) => {
    const previous = simplified[index]
    const length = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)
    if (length < minimumSegmentLength) return []

    const keys: string[] = []
    const isVertical = Math.abs(previous.x - point.x) < 0.5
    const fixed = Math.round((isVertical ? previous.x : previous.y) / 8) * 8
    const start = Math.round(Math.min(isVertical ? previous.y : previous.x, isVertical ? point.y : point.x) / 24)
    const end = Math.round(Math.max(isVertical ? previous.y : previous.x, isVertical ? point.y : point.x) / 24)

    if (end - start > 1000) return []

    for (let step = start; step <= end; step += 1) {
      keys.push(`${isVertical ? 'v' : 'h'}:${fixed}:${step}`)
    }

    return keys
  })
}

const routeOverlapIndex = (points: RoutePoint[], occupancy: Map<string, number>): number => {
  const keys = routeSegmentKeys(points)
  if (keys.length === 0) return 0
  return Math.max(0, ...keys.map((key) => occupancy.get(key) ?? 0))
}

const routeLength = (points: RoutePoint[]): number =>
  points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0)

const routeBendCount = (points: RoutePoint[]): number => {
  const simplified = simplifyOrthogonalPoints(points)
  return Math.max(0, simplified.length - 2)
}

const targetHandleForRouteDirection = (direction: AnchorDirection, sameLane: boolean): string =>
  sameLane && (direction === 'top' || direction === 'bottom') ? `${direction}-gap-target` : `${direction}-target`

const bottomCorridorOffset = (sourceBounds: RouteBounds, targetBounds: RouteBounds, allBounds: RouteBounds[], sameLane: boolean): number | undefined => {
  if (sameLane || targetBounds.center.y >= sourceBounds.center.y - 80) return undefined

  const maxBottom = Math.max(...allBounds.map((bounds) => bounds.bottom))
  if (sourceBounds.bottom < maxBottom - 120) return undefined

  const corridorY = maxBottom + 72
  const source = anchorForDirection(sourceBounds, 'bottom')
  const target = anchorForDirection(targetBounds, 'bottom')
  return corridorY - (source.y + target.y) / 2
}

const lowerTerminalCorridorOffset = (sourceBounds: RouteBounds, targetBounds: RouteBounds, blockedBounds: RouteBounds[], sameLane: boolean): number | undefined => {
  if (sameLane || targetBounds.center.y <= sourceBounds.center.y + 80) return undefined

  const minX = Math.min(sourceBounds.center.x, targetBounds.center.x) - 32
  const maxX = Math.max(sourceBounds.center.x, targetBounds.center.x) + 32
  const blockers = blockedBounds.filter((bounds) => bounds.bottom > sourceBounds.bottom && bounds.top < targetBounds.top && bounds.right >= minX && bounds.left <= maxX)
  if (blockers.length === 0) return undefined

  const corridorY = Math.max(...blockers.map((bounds) => bounds.bottom)) + 72
  if (corridorY >= targetBounds.top - 32) return undefined

  const source = anchorForDirection(sourceBounds, 'bottom')
  const target = anchorForDirection(targetBounds, 'top')
  return corridorY - (source.y + target.y) / 2
}

const reserveRouteSegments = (points: RoutePoint[], occupancy: Map<string, number>, index: number) => {
  routeSegmentKeys(points).forEach((key) => occupancy.set(key, Math.max(occupancy.get(key) ?? 0, index + 1)))
}

const roundedOrthogonalPath = (points: RoutePoint[]): string => {
  const simplified = simplifyOrthogonalPoints(points)
  if (simplified.length === 0) return ''
  if (simplified.length === 1) return `M ${simplified[0].x} ${simplified[0].y}`
  if (simplified.length === 2) return `M ${simplified[0].x} ${simplified[0].y} L ${simplified[1].x} ${simplified[1].y}`

  let path = `M ${simplified[0].x} ${simplified[0].y}`

  for (let index = 1; index < simplified.length - 1; index += 1) {
    const previous = simplified[index - 1]
    const current = simplified[index]
    const next = simplified[index + 1]
    const incomingLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)
    const outgoingLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y)
    const radius = Math.min(cornerRadius, incomingLength / 2, outgoingLength / 2)

    if (radius <= 0) {
      path += ` L ${current.x} ${current.y}`
      continue
    }

    const incomingDirection = { x: sign(current.x - previous.x), y: sign(current.y - previous.y) }
    const outgoingDirection = { x: sign(next.x - current.x), y: sign(next.y - current.y) }
    const cornerStart = { x: current.x - incomingDirection.x * radius, y: current.y - incomingDirection.y * radius }
    const cornerEnd = { x: current.x + outgoingDirection.x * radius, y: current.y + outgoingDirection.y * radius }

    path += ` L ${cornerStart.x} ${cornerStart.y} Q ${current.x} ${current.y} ${cornerEnd.x} ${cornerEnd.y}`
  }

  const last = simplified[simplified.length - 1]
  return `${path} L ${last.x} ${last.y}`
}

const arrowKeyForSegment = (from: RoutePoint, to: RoutePoint): string => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up'
  return `${Math.round(to.x)}:${Math.round(to.y)}:${direction}`
}

const arrowHeadPoints = (tail: RoutePoint, tip: RoutePoint, size: number): string => {
  const dx = tip.x - tail.x
  const dy = tip.y - tail.y
  const length = Math.hypot(dx, dy) || 1
  const unitX = dx / length
  const unitY = dy / length
  const baseX = tip.x - unitX * size
  const baseY = tip.y - unitY * size
  const halfWidth = size * 0.68
  const perpX = -unitY * halfWidth
  const perpY = unitX * halfWidth
  return `${tip.x},${tip.y} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`
}

function StackedArrowhead({ tail, tip, colors }: { tail: RoutePoint; tip: RoutePoint; colors: string[] }) {
  const count = colors.length
  const baseSize = count > 1 ? 16 + (count - 1) * 4 : 16

  return (
    <g pointerEvents="none">
      {colors.map((color, index) => {
        const size = Math.max(12, baseSize - index * 4)
        return <polygon key={`${color}-${index}`} points={arrowHeadPoints(tail, tip, size)} fill={color} fillOpacity={0.96} stroke="#FFFFFF" strokeWidth={1.1} strokeLinejoin="round" />
      })}
    </g>
  )
}

function OrthogonalEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerStart,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelShowBg,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  interactionWidth,
  data,
}: EdgeProps) {
  const edgeData = data as SmartEdgeData | undefined
  const route = edgeData?.route
  const fallbackPoints = simplifyOrthogonalPoints([{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }])
  const points = route?.points?.length ? route.points : fallbackPoints
  const path = roundedOrthogonalPath(points)
  const labelPoint = edgeData?.labelPoint ?? getPathMidpoint(points)
  const sharedStartMarker = edgeData?.sharedStartMarker
  const sharedEndMarker = edgeData?.sharedEndMarker
  const startTip = points[0]
  const startTail = points[1]
  const endTail = points.at(-2)
  const endTip = points.at(-1)

  return (
    <>
      <BaseEdge
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        label={label}
        labelX={labelPoint.x}
        labelY={labelPoint.y}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}
        interactionWidth={interactionWidth}
      />
      {sharedStartMarker && startTip && startTail ? <StackedArrowhead tail={startTail} tip={startTip} colors={sharedStartMarker.colors} /> : null}
      {sharedEndMarker && endTail && endTip ? <StackedArrowhead tail={endTail} tip={endTip} colors={sharedEndMarker.colors} /> : null}
    </>
  )
}

const edgeTypes: EdgeTypes = { orthogonal: OrthogonalEdge }

const toolVariant: Partial<Record<string, DiagramNodeVariant>> = {
  Process: 'process',
  Decision: 'decision',
  Text: 'annotation',
  Start: 'startEnd',
  InputOutput: 'inputOutput',
}

const toolLabel: Partial<Record<string, string>> = {
  Process: 'New process',
  Decision: 'New decision?',
  Text: 'Add note',
  Start: 'Start / End',
  InputOutput: 'Input / output',
}

const markerForEdge = (arrowDirection: DiagramEdgeArrow, selected: boolean, color: string, hideStart = false, hideEnd = false) => {
  const marker = { type: MarkerType.ArrowClosed, color: selected ? '#6336F1' : color, width: selected ? 24 : 20, height: selected ? 24 : 20 }
  return {
    markerStart: !hideStart && (arrowDirection === 'reverse' || arrowDirection === 'both') ? marker : undefined,
    markerEnd: !hideEnd && (arrowDirection === 'forward' || arrowDirection === 'both') ? marker : undefined,
  }
}

type SwimlaneCanvasProps = {
  readOnly?: boolean
  viewportOverride?: Viewport
  canvasHeightOverride?: number
}

const defaultViewport: Viewport = { x: 0, y: 0, zoom: 0.75 }

const getCanvasContentBounds = (graph: { lanes: { x: number; width: number }[]; nodes: DiagramNode[] }, canvasHeight: number) => {
  const laneMinX = graph.lanes.length > 0 ? Math.min(...graph.lanes.map((lane) => lane.x)) : 0
  const laneMaxX = graph.lanes.length > 0 ? Math.max(...graph.lanes.map((lane) => lane.x + lane.width)) : 0
  const nodeMinX = graph.nodes.length > 0 ? Math.min(...graph.nodes.map((node) => node.position.x)) : laneMinX
  const nodeMaxX = graph.nodes.length > 0 ? Math.max(...graph.nodes.map((node) => node.position.x + nodeWidth)) : laneMaxX
  const minX = Math.min(laneMinX, nodeMinX)
  const maxX = Math.max(laneMaxX, nodeMaxX)

  return {
    minX,
    maxX,
    minY: 0,
    maxY: canvasHeight,
  }
}

const getCenteredDefaultViewport = (graph: { lanes: { x: number; width: number }[]; nodes: DiagramNode[] }, canvasHeight: number, frameWidth: number, frameHeight: number): Viewport => {
  const bounds = getCanvasContentBounds(graph, canvasHeight)
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const zoom = defaultViewport.zoom
  const x = (frameWidth - width * zoom) / 2 - bounds.minX * zoom
  const y = height * zoom < frameHeight ? (frameHeight - height * zoom) / 2 - bounds.minY * zoom : -bounds.minY * zoom

  return { x, y, zoom }
}

export function SwimlaneCanvas({ readOnly = false, viewportOverride, canvasHeightOverride }: SwimlaneCanvasProps = {}) {
  const graph = useEditorStore((state) => state.graph)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId)
  const selectedLaneId = useEditorStore((state) => state.selectedLaneId)
  const laneDeleteMessage = useEditorStore((state) => state.laneDeleteMessage)
  const laneDeleteTargetId = useEditorStore((state) => state.laneDeleteTargetId)
  const showGrid = useEditorStore((state) => state.showGrid)
  const activeTool = useEditorStore((state) => state.activeTool)
  const pendingEdgeArrowDirection = useEditorStore((state) => state.pendingEdgeArrowDirection)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const flowRef = useRef<ReactFlowInstance<Node<DiagramNodeData>, Edge> | null>(null)
  const hasCenteredDefaultViewportRef = useRef(false)
  const [viewport, setViewport] = useState<Viewport>(viewportOverride ?? defaultViewport)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [connectorSourceNodeId, setConnectorSourceNodeId] = useState<string | null>(null)
  const [connectorMessage, setConnectorMessage] = useState<string | null>(null)
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; viewport: Viewport } | null>(null)
  const mousePanStartRef = useRef<{ x: number; y: number; viewport: Viewport } | null>(null)
  const selectNode = useEditorStore((state) => state.selectNode)
  const selectEdge = useEditorStore((state) => state.selectEdge)
  const selectLane = useEditorStore((state) => state.selectLane)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const moveNodeToPosition = useEditorStore((state) => state.moveNodeToPosition)
  const addNode = useEditorStore((state) => state.addNode)
  const addEdge = useEditorStore((state) => state.addEdge)
  const deleteSelection = useEditorStore((state) => state.deleteSelection)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const addLane = useEditorStore((state) => state.addLane)
  const deleteLane = useEditorStore((state) => state.deleteLane)
  const canDeleteLane = useEditorStore((state) => state.canDeleteLane)
  const setZoom = useEditorStore((state) => state.setZoom)
  const setActiveTool = useEditorStore((state) => state.setActiveTool)
  const isPanMode = activeTool === 'Pan'
  const isConnectorMode = activeTool === 'Connector'
  const shapeVariant = toolVariant[activeTool]
  const isShapeMode = Boolean(shapeVariant)
  const isAutoPanActive = isPanMode || (!isConnectorMode && hoveredNodeId === null && !isShapeMode)

  const nodes = useMemo<Node<DiagramNodeData>[]>(
    () => {
      const outgoingCountByNodeId = new Map<string, number>()
      graph.edges.forEach((edge) => {
        outgoingCountByNodeId.set(edge.source, (outgoingCountByNodeId.get(edge.source) ?? 0) + 1)
      })

      return graph.nodes.map((node) => {
        const outgoingCount = outgoingCountByNodeId.get(node.id) ?? 0
        const maxOutgoing = maxOutgoingEdgesForSource(node.data.variant)
        const validationError = outgoingCount > maxOutgoing ? `${node.data.variant === 'decision' ? 'Decision' : 'Block'} has ${outgoingCount} targets; maximum is ${maxOutgoing}.` : undefined

        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: { ...node.data, validationError },
          selected: node.id === selectedNodeId || node.id === connectorSourceNodeId,
          className: isPanMode ? 'pointer-events-none' : isConnectorMode && connectorSourceNodeId && node.id !== connectorSourceNodeId ? 'swimlane-diagram-node ring-2 ring-[#C7B9FF]/50' : 'swimlane-diagram-node',
        }
      })
    },
    [graph.nodes, graph.edges, selectedNodeId, connectorSourceNodeId, isConnectorMode, isPanMode],
  )

  const edges = useMemo<Edge[]>(() => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    const outgoingCountByNodeId = new Map<string, number>()
    graph.edges.forEach((edge) => {
      outgoingCountByNodeId.set(edge.source, (outgoingCountByNodeId.get(edge.source) ?? 0) + 1)
    })
    const outerLaneSourceHandle = (laneId: string): string | undefined => {
      const laneIndex = graph.lanes.findIndex((lane) => lane.id === laneId)
      if (laneIndex === 0) return 'left-source'
      if (laneIndex === graph.lanes.length - 1) return 'right-source'
      return undefined
    }
    const preferredSameLaneSourceHandleByEdgeId = new Map<string, string>()
    graph.nodes.forEach((node) => {
      const sourceBounds = shapeBoundsForNode(node)
      if (node.data.variant === 'decision') {
        const outgoingEdges = graph.edges
          .map((edge) => ({ edge, target: nodeById.get(edge.target) }))
          .filter((entry): entry is { edge: typeof graph.edges[number]; target: DiagramNode } => entry.edge.source === node.id && entry.target !== undefined && entry.target.data.laneId === node.data.laneId)
          .map(({ edge, target }) => ({ edge, targetBounds: shapeBoundsForNode(target) }))
          .sort((left, right) => Math.abs(left.targetBounds.center.y - sourceBounds.center.y) - Math.abs(right.targetBounds.center.y - sourceBounds.center.y))
        outgoingEdges.forEach(({ edge, targetBounds }, index) => {
          const targetIsBelow = targetBounds.center.y >= sourceBounds.center.y
          preferredSameLaneSourceHandleByEdgeId.set(edge.id, index === 0 ? (targetIsBelow ? 'bottom-source' : 'top-source') : outerLaneSourceHandle(node.data.laneId) ?? 'left-source')
        })
        return
      }

      const outsideHandle = outerLaneSourceHandle(node.data.laneId)
      if (!outsideHandle) return
      graph.edges.forEach((edge) => {
        const target = nodeById.get(edge.target)
        if (edge.source !== node.id || !target || target.data.laneId !== node.data.laneId) return
        const targetBounds = shapeBoundsForNode(target)
        if (Math.abs(targetBounds.center.y - sourceBounds.center.y) <= 240) return
        preferredSameLaneSourceHandleByEdgeId.set(edge.id, outsideHandle)
      })
    })
    const reservedSourceDirectionsByNodeId = new Map<string, Set<AnchorDirection>>()
    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const direction = directionFromHandle(preferredSameLaneSourceHandleByEdgeId.get(edge.id))
      if (source?.data.variant !== 'decision' || !direction || (direction !== 'left' && direction !== 'right')) return
      const reservedDirections = reservedSourceDirectionsByNodeId.get(edge.source) ?? new Set<AnchorDirection>()
      reservedDirections.add(direction)
      reservedSourceDirectionsByNodeId.set(edge.source, reservedDirections)
    })
    const targetDemandByNodeId = new Map<string, Map<AnchorDirection, number>>()
    const endpointDemandByNodeId = new Map<string, Map<AnchorDirection, number>>()
    const addEndpointDemand = (nodeId: string, direction?: AnchorDirection) => {
      if (!direction) return
      const endpointDemand = endpointDemandByNodeId.get(nodeId) ?? new Map<AnchorDirection, number>()
      endpointDemand.set(direction, (endpointDemand.get(direction) ?? 0) + 1)
      endpointDemandByNodeId.set(nodeId, endpointDemand)
    }
    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      if (!source || !target) return
      const sourceBounds = shapeBoundsForNode(source)
      const targetBounds = shapeBoundsForNode(target)
      const sameLane = source.data.laneId === target.data.laneId
      const inferredHandles = inferEdgeHandles(sourceBounds, targetBounds, sameLane)
      const decisionSourceHandle = preferredSameLaneSourceHandleByEdgeId.get(edge.id)
      const preferredSourceDirection = directionFromHandle(edge.sourceHandle ?? decisionSourceHandle)
      const preferredTargetHandle = sameLane && (preferredSourceDirection === 'left' || preferredSourceDirection === 'right') ? targetHandleForRouteDirection(preferredSourceDirection, true) : inferredHandles.targetHandle
      const sourceDirection = directionFromHandle(edge.sourceHandle ?? decisionSourceHandle ?? inferredHandles.sourceHandle)
      const targetDirection = directionFromHandle(edge.targetHandle ?? preferredTargetHandle)
      addEndpointDemand(edge.source, sourceDirection)
      addEndpointDemand(edge.target, targetDirection)
      if (!targetDirection) return
      const targetDemand = targetDemandByNodeId.get(edge.target) ?? new Map<AnchorDirection, number>()
      targetDemand.set(targetDirection, (targetDemand.get(targetDirection) ?? 0) + 1)
      targetDemandByNodeId.set(edge.target, targetDemand)
    })
    const primaryTerminalSourceByTargetId = new Map<string, string>()
    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      if (!source || !target || (outgoingCountByNodeId.get(edge.target) ?? 0) > 0) return
      const sourceBounds = shapeBoundsForNode(source)
      const targetBounds = shapeBoundsForNode(target)
      const currentSourceId = primaryTerminalSourceByTargetId.get(edge.target)
      const currentSource = currentSourceId ? nodeById.get(currentSourceId) : undefined
      const currentDelta = currentSource ? Math.abs(shapeBoundsForNode(currentSource).center.y - targetBounds.center.y) : Number.POSITIVE_INFINITY
      const nextDelta = Math.abs(sourceBounds.center.y - targetBounds.center.y)
      if (nextDelta >= currentDelta) return
      primaryTerminalSourceByTargetId.set(edge.target, edge.source)
    })
    const usedSourceDirectionsByNodeId = new Map<string, Set<AnchorDirection>>()
    const sourceBlockedDirectionsByNodeId = new Map<string, Set<AnchorDirection>>()
    const routeOccupancy = new Map<string, number>()
    const shouldUseSmartRouting = graph.nodes.length <= maxSmartRoutingNodes && graph.edges.length <= maxSmartRoutingEdges
    const resolvedEdges = graph.edges.map((edge, index) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sameLane = source?.data.laneId === target?.data.laneId
      const sourceBounds = source ? shapeBoundsForNode(source) : undefined
      const targetBounds = target ? shapeBoundsForNode(target) : undefined
      const inferredHandles = sourceBounds && targetBounds ? inferEdgeHandles(sourceBounds, targetBounds, sameLane) : undefined
      const decisionSourceHandle = preferredSameLaneSourceHandleByEdgeId.get(edge.id)
      const usedSourceDirections = usedSourceDirectionsByNodeId.get(edge.source) ?? new Set<AnchorDirection>()
      const sourceBlockedDirections = sourceBlockedDirectionsByNodeId.get(edge.source) ?? new Set<AnchorDirection>()
      const targetOccupiedDirections = new Set<AnchorDirection>(usedSourceDirectionsByNodeId.get(edge.target))
      reservedSourceDirectionsByNodeId.get(edge.target)?.forEach((direction) => targetOccupiedDirections.add(direction))
      const preferredSourceDirection = directionFromHandle(edge.sourceHandle ?? decisionSourceHandle)
      const preferredTargetHandle = sameLane && (preferredSourceDirection === 'left' || preferredSourceDirection === 'right') ? targetHandleForRouteDirection(preferredSourceDirection, true) : inferredHandles?.targetHandle
      const requestedSourceHandle = edge.sourceHandle ?? decisionSourceHandle ?? inferredHandles?.sourceHandle
      const requestedTargetHandle = edge.targetHandle ?? preferredTargetHandle
      const resolvedHandles = sourceBounds && targetBounds && source
        ? resolveEdgeHandles({
            sourceBounds,
            targetBounds,
            sameLane,
            requestedSourceHandle,
            requestedTargetHandle,
            usedSourceDirections,
            sourceOccupiedDirections: sourceBlockedDirections,
            targetOccupiedDirections,
            sourceVariant: source.data.variant,
          })
        : undefined
      let sourceHandle = resolvedHandles?.sourceHandle ?? edge.sourceHandle ?? decisionSourceHandle ?? inferredHandles?.sourceHandle
      let targetHandle = resolvedHandles?.targetHandle ?? edge.targetHandle ?? inferredHandles?.targetHandle
      const selected = edge.id === selectedEdgeId
      const arrowDirection = edge.data?.arrowDirection ?? 'forward'
      let route = shouldUseSmartRouting && source && target ? buildSmartRoute(source, target, graph.nodes, 0, sourceHandle, targetHandle) : undefined
      let routeGroupIndex = 0
      if (shouldUseSmartRouting && source && target) {
        const sameLaneDownwardGap = sourceBounds && targetBounds && sameLane ? targetBounds.center.y - sourceBounds.center.y : 0
        const requestedTargetHandles = edge.targetHandle ? [edge.targetHandle] : [...new Set([preferredTargetHandle, inferredHandles?.targetHandle, targetHandle].filter((handle): handle is string => Boolean(handle)))]
        const candidateHandles: { sourceHandle?: string; targetHandle?: string; offset?: number }[] = requestedTargetHandles.map((candidateTargetHandle) => ({ sourceHandle, targetHandle: candidateTargetHandle }))
        if (!edge.sourceHandle && !edge.targetHandle && sameLaneDownwardGap > 220 && !sourceBlockedDirections.has('left') && !targetOccupiedDirections.has('left')) {
          candidateHandles.push({ sourceHandle: 'left-source', targetHandle: 'left-target' })
        }
        const requestedTargetDirection = directionFromHandle(requestedTargetHandles[0] ?? requestedTargetHandle)
        const targetDemand = requestedTargetDirection ? targetDemandByNodeId.get(edge.target)?.get(requestedTargetDirection) ?? 0 : 0
        const allBounds = graph.nodes.map(shapeBoundsForNode)
        const blockedBounds = graph.nodes.filter((node) => node.id !== edge.source && node.id !== edge.target).map(shapeBoundsForNode)
        const targetIsTerminal = (outgoingCountByNodeId.get(edge.target) ?? 0) === 0
        const isPrimaryTerminalSource = targetIsTerminal && primaryTerminalSourceByTargetId.get(edge.target) === edge.source
        if (!edge.sourceHandle && !edge.targetHandle && sourceBounds && targetBounds && !isPrimaryTerminalSource && !targetOccupiedDirections.has('top') && lateralSideTargetCorridorIsBlocked(sourceBounds, targetBounds, blockedBounds, sameLane)) {
          candidateHandles.push({ sourceHandle, targetHandle: 'top-target' })
        }
        const bottomOffset = sourceBounds && targetBounds ? bottomCorridorOffset(sourceBounds, targetBounds, allBounds, sameLane) : undefined
        const bottomDemand = endpointDemandByNodeId.get(edge.source)?.get('bottom') ?? 0
        const lowerTerminalOffset = sourceBounds && targetBounds ? lowerTerminalCorridorOffset(sourceBounds, targetBounds, blockedBounds, sameLane) : undefined
        if (!edge.sourceHandle && !edge.targetHandle && !sameLane && targetIsTerminal && sourceBounds && targetBounds && targetBounds.center.y > sourceBounds.center.y + 80 && targetDemand > 1 && bottomDemand <= 1 && !targetOccupiedDirections.has('top') && !isPrimaryTerminalSource) {
          candidateHandles.push({ sourceHandle: 'bottom-source', targetHandle: 'top-target', offset: lowerTerminalOffset })
        }
        if (!edge.sourceHandle && !edge.targetHandle && targetDemand > 1 && bottomOffset !== undefined && bottomDemand <= 1) {
          candidateHandles.push({ sourceHandle: 'bottom-source', targetHandle: 'bottom-target', offset: bottomOffset })
        }

        const uniqueCandidateHandles = [...new Map(candidateHandles.map((handles) => [`${handles.sourceHandle}:${handles.targetHandle}:${handles.offset ?? 0}`, handles])).values()]
        const maxRouteVariants = Math.max(1, Math.min(graph.edges.length, 12))
        let bestRoute = route
        let bestSourceHandle = sourceHandle
        let bestTargetHandle = targetHandle
        let bestScore = Number.POSITIVE_INFINITY
        let bestRouteGroupIndex = 0
        uniqueCandidateHandles.forEach((candidateHandlesEntry) => {
          for (let candidateIndex = 0; candidateIndex < maxRouteVariants; candidateIndex += 1) {
            const routeOffset = candidateHandlesEntry.offset ?? (candidateIndex % 2 === 0 ? 1 : -1) * Math.ceil(candidateIndex / 2) * edgeOffsetStep
            const candidateRoute = buildSmartRoute(source, target, graph.nodes, routeOffset, candidateHandlesEntry.sourceHandle, candidateHandlesEntry.targetHandle)
            const overlap = candidateRoute.points.length > 0 ? routeOverlapIndex(candidateRoute.points, routeOccupancy) : Number.POSITIVE_INFINITY
            const score = candidateRoute.blockedBoundsCount * 100000 + candidateRoute.blockedSegmentCount * 10000 + overlap * 1000 + routeBendCount(candidateRoute.points) * 80 + routeLength(candidateRoute.points)
            if (score < bestScore) {
              bestRoute = candidateRoute
              bestSourceHandle = candidateHandlesEntry.sourceHandle
              bestTargetHandle = candidateHandlesEntry.targetHandle
              bestScore = score
              bestRouteGroupIndex = candidateIndex
            }
            if (overlap === 0 && candidateRoute.isClear) break
          }
        })
        route = bestRoute
        sourceHandle = bestSourceHandle
        targetHandle = bestTargetHandle
        routeGroupIndex = bestRouteGroupIndex
      }
      const sourceDirection = directionFromHandle(sourceHandle)
      if (sourceDirection) {
        usedSourceDirections.add(sourceDirection)
        usedSourceDirectionsByNodeId.set(edge.source, usedSourceDirections)
        sourceBlockedDirections.add(sourceDirection)
        sourceBlockedDirectionsByNodeId.set(edge.source, sourceBlockedDirections)
      }
      const targetDirection = directionFromHandle(targetHandle)
      if (targetDirection) {
        const targetSourceBlockedDirections = sourceBlockedDirectionsByNodeId.get(edge.target) ?? new Set<AnchorDirection>()
        targetSourceBlockedDirections.add(targetDirection)
        sourceBlockedDirectionsByNodeId.set(edge.target, targetSourceBlockedDirections)
      }
      if (route?.points) reserveRouteSegments(route.points, routeOccupancy, routeGroupIndex)
      return {
        edge,
        index,
        color: edgeColors[index % edgeColors.length],
        selected,
        arrowDirection,
        route,
        sourceHandle,
        targetHandle,
      }
    })

    const sharedStartGroups = new Map<string, { edgeId: string; color: string }[]>()
    const sharedEndGroups = new Map<string, { edgeId: string; color: string }[]>()

    resolvedEdges.forEach(({ edge, route, color, selected, arrowDirection }) => {
      const points = route?.points
      if (!points || points.length < 2) return
      const markerColor = selected ? '#6336F1' : color
      if (arrowDirection === 'reverse' || arrowDirection === 'both') {
        const key = arrowKeyForSegment(points[1], points[0])
        sharedStartGroups.set(key, [...(sharedStartGroups.get(key) ?? []), { edgeId: edge.id, color: markerColor }])
      }
      if (arrowDirection === 'forward' || arrowDirection === 'both') {
        const key = arrowKeyForSegment(points[points.length - 2], points[points.length - 1])
        sharedEndGroups.set(key, [...(sharedEndGroups.get(key) ?? []), { edgeId: edge.id, color: markerColor }])
      }
    })

    return resolvedEdges.map(({ edge, color, selected, arrowDirection, route, sourceHandle, targetHandle }) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const points = route?.points
      const sourceDirection = directionFromHandle(sourceHandle)
      const fallbackLabelPoints = source && target && sourceDirection ? [anchorForDirection(shapeBoundsForNode(source), sourceDirection), shapeBoundsForNode(target).center] : undefined
      const labelPoint = source?.data.variant === 'decision' ? decisionLabelPoint(points ?? fallbackLabelPoints ?? [], sourceDirection) : undefined
      const sharedStartGroup = points && points.length >= 2 && (arrowDirection === 'reverse' || arrowDirection === 'both')
        ? sharedStartGroups.get(arrowKeyForSegment(points[1], points[0]))
        : undefined
      const sharedEndGroup = points && points.length >= 2 && (arrowDirection === 'forward' || arrowDirection === 'both')
        ? sharedEndGroups.get(arrowKeyForSegment(points[points.length - 2], points[points.length - 1]))
        : undefined
      const sharedStartMarker = sharedStartGroup && sharedStartGroup.length > 1 && sharedStartGroup[0]?.edgeId === edge.id
        ? { colors: sharedStartGroup.map((entry) => entry.color) }
        : undefined
      const sharedEndMarker = sharedEndGroup && sharedEndGroup.length > 1 && sharedEndGroup[0]?.edgeId === edge.id
        ? { colors: sharedEndGroup.map((entry) => entry.color) }
        : undefined

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: 'orthogonal',
        animated: edge.animated,
        label: edge.label,
        data: {
          ...edge.data,
          route,
          labelPoint,
          sharedStartMarker,
          sharedEndMarker,
        },
        selected,
        ...markerForEdge(arrowDirection, selected, color, Boolean(sharedStartGroup && sharedStartGroup.length > 1), Boolean(sharedEndGroup && sharedEndGroup.length > 1)),
        style: { stroke: selected ? '#6336F1' : color, strokeWidth: selected ? 3 : 1.9, strokeDasharray: arrowDirection === 'none' ? '5 4' : undefined },
        labelStyle: { fill: '#334155', fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.92 },
      }
    })
  }, [graph.edges, graph.nodes, selectedEdgeId])

  const nodeCountsByLane = useMemo(() => {
    const counts = new Map<string, number>()
    graph.nodes.forEach((node) => counts.set(node.data.laneId, (counts.get(node.data.laneId) ?? 0) + 1))
    return counts
  }, [graph.nodes])

  const canvasHeight = useMemo(() => canvasHeightOverride ?? Math.max(1048, ...graph.nodes.map((node) => node.position.y + 180)), [canvasHeightOverride, graph.nodes])
  const hasCanvasContent = graph.nodes.length > 0 || graph.lanes.length > 0

  useEffect(() => {
    if (viewportOverride) setViewport(viewportOverride)
  }, [viewportOverride])

  useEffect(() => {
    if (viewportOverride) return
    if (!hasCanvasContent) {
      hasCenteredDefaultViewportRef.current = false
      setViewport(defaultViewport)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const centerDefaultViewport = () => {
      if (hasCenteredDefaultViewportRef.current || canvas.clientWidth === 0 || canvas.clientHeight === 0) return
      const nextViewport = getCenteredDefaultViewport(graph, canvasHeight, canvas.clientWidth, canvas.clientHeight)
      hasCenteredDefaultViewportRef.current = true
      setViewport(nextViewport)
    }

    centerDefaultViewport()
    const resizeObserver = new ResizeObserver(centerDefaultViewport)
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
  }, [canvasHeight, graph, hasCanvasContent, viewportOverride])

  const handleNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    if (isConnectorMode) {
      if (!connectorSourceNodeId) {
        setConnectorSourceNodeId(node.id)
        setConnectorMessage(`Connecting from ${String(node.data.label)}. Click a target block.`)
        selectNode(node.id)
        return
      }
      if (connectorSourceNodeId !== node.id) {
        const edgeId = addEdge({ source: connectorSourceNodeId, target: node.id, arrowDirection: pendingEdgeArrowDirection })
        setConnectorSourceNodeId(null)
        setConnectorMessage(edgeId ? 'Connector created.' : 'Connector already exists.')
        return
      }
      setConnectorMessage('Click a different target block.')
      selectNode(node.id)
      return
    }
    setConnectorMessage(null)
    selectNode(node.id)
  }, [addEdge, connectorSourceNodeId, isConnectorMode, pendingEdgeArrowDirection, selectNode])

  useEffect(() => {
    if (readOnly || !connectorMessage || connectorSourceNodeId) return
    const timeoutId = window.setTimeout(() => setConnectorMessage(null), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [connectorMessage, connectorSourceNodeId, readOnly])

  const handleEdgeClick = useCallback<EdgeMouseHandler>((event, edge) => {
    event.stopPropagation()
    setConnectorMessage(null)
    selectEdge(edge.id)
  }, [selectEdge])

  const handleNodeMouseEnter = useCallback<NodeMouseHandler>((_, node) => setHoveredNodeId(node.id), [])

  const handleNodeMouseLeave = useCallback<NodeMouseHandler>(() => setHoveredNodeId(null), [])

  const handlePaneClick = useCallback((event: React.MouseEvent<Element>) => {
    if (shapeVariant && flowRef.current) {
      const position = flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const nodeId = addNode({ variant: shapeVariant, label: toolLabel[activeTool], position })
      selectNode(nodeId)
      setActiveTool('Select')
      return
    }
    setConnectorSourceNodeId(null)
    setConnectorMessage(null)
    clearSelection()
  }, [activeTool, addNode, clearSelection, selectNode, setActiveTool, shapeVariant])

  const handleNodeDragStop = useCallback<OnNodeDrag<Node<DiagramNodeData>>>(
    (_, node) => moveNodeToPosition(node.id, node.position),
    [moveNodeToPosition],
  )

  const handleConnect = useCallback((connection: Connection) => {
    setConnectorSourceNodeId(null)
    const edgeId = addEdge({
      source: connection.source ?? '',
      target: connection.target ?? '',
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      arrowDirection: pendingEdgeArrowDirection,
    })
    setConnectorMessage(edgeId ? 'Connector created.' : 'Connector already exists.')
  }, [addEdge, pendingEdgeArrowDirection])

  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    setViewport(nextViewport)
    if (!readOnly) setZoom(Number(nextViewport.zoom.toFixed(2)))
  }, [readOnly, setZoom])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditingText = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (readOnly || isEditingText) return
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        deleteSelection()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelection, readOnly, redo, undo])

  const handlePanPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode || event.button !== 0 || !flowRef.current) return
      const nextViewport = flowRef.current.getViewport()
      panStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: nextViewport }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [isPanMode],
  )

  const handlePanPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = panStartRef.current
      if (readOnly || !isPanMode || !start || !flowRef.current) return
      const nextViewport = {
        x: start.viewport.x + event.clientX - start.x,
        y: start.viewport.y + event.clientY - start.y,
        zoom: start.viewport.zoom,
      }
      setViewport(nextViewport)
      setZoom(Number(nextViewport.zoom.toFixed(2)))
      event.preventDefault()
    },
    [isPanMode, readOnly, setZoom],
  )

  const handlePanPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId === event.pointerId) {
      panStartRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handlePanMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !isPanMode || event.button !== 0) return
      mousePanStartRef.current = { x: event.clientX, y: event.clientY, viewport }
      event.preventDefault()
    },
    [isPanMode, readOnly, viewport],
  )

  const handlePanMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const start = mousePanStartRef.current
      if (readOnly || !isPanMode || !start) return
      const nextViewport = {
        x: start.viewport.x + event.clientX - start.x,
        y: start.viewport.y + event.clientY - start.y,
        zoom: start.viewport.zoom,
      }
      setViewport(nextViewport)
      setZoom(Number(nextViewport.zoom.toFixed(2)))
      event.preventDefault()
    },
    [isPanMode, readOnly, setZoom],
  )

  const handlePanMouseUp = useCallback(() => {
    mousePanStartRef.current = null
  }, [])

  return (
    <div
      ref={canvasRef}
      data-varagraph-export-canvas="true"
      className={`relative h-full overflow-hidden rounded-md border border-[#E5E7EB] bg-white ${isConnectorMode && !readOnly ? 'connector-active' : ''} ${isAutoPanActive ? 'cursor-grab active:cursor-grabbing' : !readOnly && isShapeMode ? 'cursor-crosshair' : ''}`}
      onPointerDown={handlePanPointerDown}
      onPointerMove={handlePanPointerMove}
      onPointerUp={handlePanPointerUp}
      onPointerCancel={handlePanPointerUp}
      onMouseDown={handlePanMouseDown}
      onMouseMove={handlePanMouseMove}
      onMouseUp={handlePanMouseUp}
      onMouseLeave={handlePanMouseUp}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={isPanMode ? undefined : handleNodeClick}
        onEdgeClick={isPanMode ? undefined : handleEdgeClick}
        onNodeMouseEnter={readOnly || isPanMode ? undefined : handleNodeMouseEnter}
        onNodeMouseLeave={readOnly || isPanMode ? undefined : handleNodeMouseLeave}
        onPaneClick={isPanMode ? undefined : handlePaneClick}
        onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
        onConnect={readOnly ? undefined : handleConnect}
        onViewportChange={handleViewportChange}
        onInit={(instance) => {
          flowRef.current = instance
        }}
        viewport={viewport}
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.8}
        nodesDraggable={!readOnly && !isPanMode}
        nodesConnectable={!readOnly && isConnectorMode}
        elementsSelectable={!isPanMode}
        panOnDrag={isAutoPanActive}
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        panOnScrollSpeed={0.85}
        zoomOnScroll={false}
        selectionOnDrag={false}
        nodeClickDistance={8}
        paneClickDistance={8}
        proOptions={{ hideAttribution: true }}
      >
        <ViewportPortal>
          <LaneBackgrounds
            lanes={graph.lanes}
            height={canvasHeight}
            selectedLaneId={selectedLaneId}
            nodeCountsByLane={nodeCountsByLane}
            canDeleteLane={canDeleteLane}
            isPanMode={isPanMode}
            onSelectLane={selectLane}
            onAddLane={() => addLane()}
            onDeleteLane={deleteLane}
            laneDeleteMessage={laneDeleteMessage}
            laneDeleteTargetId={laneDeleteTargetId}
          />
        </ViewportPortal>
        {showGrid && <Background color="#D8DEE9" gap={16} size={0.8} variant={BackgroundVariant.Dots} />}
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      {!readOnly && isConnectorMode && connectorMessage && (
        <div className="pointer-events-none absolute left-4 top-4 z-40 rounded-md border border-[#C7B9FF] bg-white/95 px-3 py-2 text-[12px] font-semibold text-[#6336F1] shadow-sm">
          {connectorMessage}
        </div>
      )}
      {!readOnly && isPanMode && (
        <div
          className="absolute inset-0 z-30 cursor-grab active:cursor-grabbing"
          aria-label="Pan canvas overlay"
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={handlePanPointerUp}
          onPointerCancel={handlePanPointerUp}
          onMouseDown={handlePanMouseDown}
          onMouseMove={handlePanMouseMove}
          onMouseUp={handlePanMouseUp}
          onMouseLeave={handlePanMouseUp}
        />
      )}
    </div>
  )
}

export { nodeWidth as SWIMLANE_NODE_WIDTH }
