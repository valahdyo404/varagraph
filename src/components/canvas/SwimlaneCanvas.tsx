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
import { SwimlaneNode } from './SwimlaneNode'

const nodeTypes = { diagramNode: SwimlaneNode }

type PathPoint = {
  x: number
  y: number
}

type SmartRoute = {
  points: PathPoint[]
}

type SmartEdgeData = {
  route?: SmartRoute
}

type ShapeBounds = {
  center: PathPoint
  left: number
  right: number
  top: number
  bottom: number
}

type AnchorDirection = 'left' | 'right' | 'top' | 'bottom'

const decisionSize = 108
const decisionOffsetX = (nodeWidth - decisionSize) / 2
const decisionOffsetY = 8
const decisionVisualRadius = (Math.sqrt(2) * decisionSize) / 2
const cornerRadius = 10

const pushPathPoint = (points: PathPoint[], point: PathPoint) => {
  const previous = points.at(-1)
  if (previous && Math.abs(previous.x - point.x) < 0.5 && Math.abs(previous.y - point.y) < 0.5) return
  points.push(point)
}

const simplifyOrthogonalPoints = (points: PathPoint[]): PathPoint[] => {
  const deduped = points.reduce<PathPoint[]>((accumulator, point) => {
    pushPathPoint(accumulator, point)
    return accumulator
  }, [])

  return deduped.reduce<PathPoint[]>((accumulator, point) => {
    const first = accumulator.at(-2)
    const second = accumulator.at(-1)
    if (!first || !second) {
      accumulator.push(point)
      return accumulator
    }

    const sameVertical = Math.abs(first.x - second.x) < 0.5 && Math.abs(second.x - point.x) < 0.5
    const sameHorizontal = Math.abs(first.y - second.y) < 0.5 && Math.abs(second.y - point.y) < 0.5
    if (sameVertical || sameHorizontal) {
      accumulator[accumulator.length - 1] = point
      return accumulator
    }

    accumulator.push(point)
    return accumulator
  }, [])
}

const getPathMidpoint = (points: PathPoint[]): PathPoint => {
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

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1)

const shapeBoundsForNode = (node: DiagramNode): ShapeBounds => {
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

const anchorForDirection = (bounds: ShapeBounds, direction: AnchorDirection): PathPoint => {
  switch (direction) {
    case 'left':
      return { x: bounds.left, y: bounds.center.y }
    case 'right':
      return { x: bounds.right, y: bounds.center.y }
    case 'top':
      return { x: bounds.center.x, y: bounds.top }
    case 'bottom':
    default:
      return { x: bounds.center.x, y: bounds.bottom }
  }
}

const buildSmartRoute = (
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
): SmartRoute => {
  const sourceBounds = shapeBoundsForNode(sourceNode)
  const targetBounds = shapeBoundsForNode(targetNode)
  const dx = targetBounds.center.x - sourceBounds.center.x
  const dy = targetBounds.center.y - sourceBounds.center.y
  const routeVertically = Math.abs(dy) > Math.abs(dx)
  const sourceDirection: AnchorDirection = routeVertically ? (dy >= 0 ? 'bottom' : 'top') : dx >= 0 ? 'right' : 'left'
  const targetDirection: AnchorDirection = routeVertically ? (dy >= 0 ? 'top' : 'bottom') : dx >= 0 ? 'left' : 'right'
  const isDecisionCrossLane =
    sourceNode.data.variant === 'decision' &&
    sourceNode.data.laneId !== targetNode.data.laneId &&
    Math.abs(dx) >= Math.abs(dy) &&
    Math.abs(dy) > 0.5

  if (isDecisionCrossLane) {
    const source = anchorForDirection(sourceBounds, dx >= 0 ? 'right' : 'left')
    const target = anchorForDirection(targetBounds, dy >= 0 ? 'top' : 'bottom')
    const points: PathPoint[] = [source]
    pushPathPoint(points, { x: target.x, y: source.y })
    pushPathPoint(points, target)
    return { points: simplifyOrthogonalPoints(points) }
  }

  const source = anchorForDirection(sourceBounds, sourceDirection)
  const target = anchorForDirection(targetBounds, targetDirection)
  const points: PathPoint[] = [source]

  if (routeVertically) {
    if (Math.abs(source.x - target.x) < 0.5) {
      pushPathPoint(points, target)
    } else {
      const middleY = (source.y + target.y) / 2
      pushPathPoint(points, { x: source.x, y: middleY })
      pushPathPoint(points, { x: target.x, y: middleY })
      pushPathPoint(points, target)
    }
  } else if (Math.abs(source.y - target.y) < 0.5) {
    pushPathPoint(points, target)
  } else {
    const middleX = (source.x + target.x) / 2
    pushPathPoint(points, { x: middleX, y: source.y })
    pushPathPoint(points, { x: middleX, y: target.y })
    pushPathPoint(points, target)
  }

  return { points: simplifyOrthogonalPoints(points) }
}

const roundedOrthogonalPath = (points: PathPoint[]): string => {
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
  const route = (data as SmartEdgeData | undefined)?.route
  const fallbackPoints = simplifyOrthogonalPoints([{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }])
  const points = route?.points?.length ? route.points : fallbackPoints
  const path = roundedOrthogonalPath(points)
  const labelPoint = getPathMidpoint(points)

  return (
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

const markerForEdge = (arrowDirection: DiagramEdgeArrow, selected: boolean) => {
  const marker = { type: MarkerType.ArrowClosed, color: selected ? '#6336F1' : '#64748B', width: selected ? 24 : 20, height: selected ? 24 : 20 }
  return {
    markerStart: arrowDirection === 'reverse' || arrowDirection === 'both' ? marker : undefined,
    markerEnd: arrowDirection === 'forward' || arrowDirection === 'both' ? marker : undefined,
  }
}

type SwimlaneCanvasProps = {
  readOnly?: boolean
  viewportOverride?: Viewport
  canvasHeightOverride?: number
}

const defaultViewport: Viewport = { x: 0, y: 0, zoom: 0.75 }

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
  const flowRef = useRef<ReactFlowInstance<Node<DiagramNodeData>, Edge> | null>(null)
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
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        selected: node.id === selectedNodeId || node.id === connectorSourceNodeId,
        className: isPanMode ? 'pointer-events-none' : isConnectorMode && connectorSourceNodeId && node.id !== connectorSourceNodeId ? 'swimlane-diagram-node ring-2 ring-[#C7B9FF]/50' : 'swimlane-diagram-node',
      })),
    [graph.nodes, selectedNodeId, connectorSourceNodeId, isConnectorMode, isPanMode],
  )

  const edges = useMemo<Edge[]>(() => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    return graph.edges.map((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sameLane = source?.data.laneId === target?.data.laneId
      const sourceCenterY = source ? source.position.y + estimateNodeHeight(source) / 2 : 0
      const targetCenterY = target ? target.position.y + estimateNodeHeight(target) / 2 : 0
      const targetIsLeft = (target?.position.x ?? 0) < (source?.position.x ?? 0)
      const verticalDelta = targetCenterY - sourceCenterY
      const targetIsAbove = verticalDelta < 0
      const computedSourceHandle = sameLane ? (targetIsAbove ? 'top-source' : 'bottom-source') : targetIsLeft ? 'left-source' : 'right-source'
      const computedTargetHandle = sameLane
        ? targetIsAbove
          ? 'bottom-gap-target'
          : 'top-gap-target'
        : targetIsLeft
          ? 'right-target'
          : 'left-target'
      const sourceHandle = edge.sourceHandle ?? computedSourceHandle
      const targetHandle = edge.targetHandle ?? computedTargetHandle
      const selected = edge.id === selectedEdgeId
      const arrowDirection = edge.data?.arrowDirection ?? 'forward'
      const route = source && target ? buildSmartRoute(source, target) : undefined

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: 'orthogonal',
        animated: edge.animated,
        label: edge.label,
        data: { ...edge.data, route },
        selected,
        ...markerForEdge(arrowDirection, selected),
        style: { stroke: selected ? '#6336F1' : '#64748B', strokeWidth: selected ? 3 : 1.9, strokeDasharray: arrowDirection === 'none' ? '5 4' : undefined },
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

  useEffect(() => {
    if (viewportOverride) setViewport(viewportOverride)
  }, [viewportOverride])

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
      if (readOnly || !isPanMode || event.button !== 0 || !flowRef.current) return
      const nextViewport = flowRef.current.getViewport()
      panStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: nextViewport }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [isPanMode, readOnly],
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
      data-varagraph-export-canvas="true"
      className={`relative h-full overflow-hidden rounded-md border border-[#E5E7EB] bg-white ${isConnectorMode && !readOnly ? 'connector-active' : ''} ${!readOnly && isAutoPanActive ? 'cursor-grab active:cursor-grabbing' : !readOnly && isShapeMode ? 'cursor-crosshair' : ''}`}
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
        onNodeClick={readOnly || isPanMode ? undefined : handleNodeClick}
        onEdgeClick={readOnly || isPanMode ? undefined : handleEdgeClick}
        onNodeMouseEnter={readOnly || isPanMode ? undefined : handleNodeMouseEnter}
        onNodeMouseLeave={readOnly || isPanMode ? undefined : handleNodeMouseLeave}
        onPaneClick={readOnly || isPanMode ? undefined : handlePaneClick}
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
        elementsSelectable={!readOnly && !isPanMode}
        panOnDrag={!readOnly && isAutoPanActive}
        panOnScroll={!readOnly}
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
