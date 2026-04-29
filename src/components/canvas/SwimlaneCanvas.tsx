import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  PanOnScrollMode,
  ReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import type { DiagramEdgeArrow, DiagramNodeData, DiagramNodeVariant } from '../../types/graph'
import { useEditorStore } from '../../store/editorStore'
import { LaneBackgrounds } from './LaneBackgrounds'
import { nodeWidth } from '../../lib/graph/autoLayout'
import { SwimlaneNode } from './SwimlaneNode'

const nodeTypes = { diagramNode: SwimlaneNode }

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
  const marker = { type: MarkerType.ArrowClosed, color: selected ? '#6336F1' : '#94A3B8', width: 18, height: 18 }
  return {
    markerStart: arrowDirection === 'reverse' || arrowDirection === 'both' ? marker : undefined,
    markerEnd: arrowDirection === 'forward' || arrowDirection === 'both' ? marker : undefined,
  }
}

export function SwimlaneCanvas() {
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
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.75 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [connectorSourceNodeId, setConnectorSourceNodeId] = useState<string | null>(null)
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
        className: isPanMode ? 'pointer-events-none' : 'swimlane-diagram-node',
      })),
    [graph.nodes, selectedNodeId, connectorSourceNodeId, isPanMode],
  )

  const edges = useMemo<Edge[]>(() => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    return graph.edges.map((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sameLane = source?.data.laneId === target?.data.laneId
      const targetIsLeft = (target?.position.x ?? 0) < (source?.position.x ?? 0)
      const targetIsAbove = (target?.position.y ?? 0) < (source?.position.y ?? 0)
      const sourceHandle = edge.sourceHandle ?? (sameLane ? (targetIsAbove ? 'top-source' : 'bottom-source') : targetIsLeft ? 'left-source' : 'right-source')
      const targetHandle = edge.targetHandle ?? (sameLane ? (targetIsAbove ? 'bottom-target' : 'top-target') : targetIsLeft ? 'right-target' : 'left-target')
      const selected = edge.id === selectedEdgeId
      const arrowDirection = edge.data?.arrowDirection ?? 'forward'

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: edge.type,
        animated: edge.animated,
        label: edge.label,
        data: edge.data,
        selected,
        ...markerForEdge(arrowDirection, selected),
        style: { stroke: selected ? '#6336F1' : '#94A3B8', strokeWidth: selected ? 2.2 : 1.5, strokeDasharray: arrowDirection === 'none' ? '5 4' : undefined },
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

  const canvasHeight = useMemo(() => Math.max(1048, ...graph.nodes.map((node) => node.position.y + 180)), [graph.nodes])

  const handleNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    if (isConnectorMode) {
      if (!connectorSourceNodeId) {
        setConnectorSourceNodeId(node.id)
        selectNode(node.id)
        return
      }
      if (connectorSourceNodeId !== node.id) {
        addEdge({ source: connectorSourceNodeId, target: node.id, arrowDirection: pendingEdgeArrowDirection })
        setConnectorSourceNodeId(null)
        return
      }
      setConnectorSourceNodeId(null)
      clearSelection()
      return
    }
    selectNode(node.id)
  }, [addEdge, clearSelection, connectorSourceNodeId, isConnectorMode, pendingEdgeArrowDirection, selectNode])

  const handleEdgeClick = useCallback<EdgeMouseHandler>((event, edge) => {
    event.stopPropagation()
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
    clearSelection()
  }, [activeTool, addNode, clearSelection, selectNode, setActiveTool, shapeVariant])

  const handleNodeDragStop = useCallback<OnNodeDrag<Node<DiagramNodeData>>>(
    (_, node) => moveNodeToPosition(node.id, node.position),
    [moveNodeToPosition],
  )

  const handleConnect = useCallback((connection: Connection) => {
    setConnectorSourceNodeId(null)
    addEdge({
      source: connection.source ?? '',
      target: connection.target ?? '',
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      arrowDirection: pendingEdgeArrowDirection,
    })
  }, [addEdge, pendingEdgeArrowDirection])

  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    setViewport(nextViewport)
    setZoom(Number(nextViewport.zoom.toFixed(2)))
  }, [setZoom])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditingText = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (isEditingText) return
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
  }, [deleteSelection, redo, undo])

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
      if (!isPanMode || !start || !flowRef.current) return
      const nextViewport = {
        x: start.viewport.x + event.clientX - start.x,
        y: start.viewport.y + event.clientY - start.y,
        zoom: start.viewport.zoom,
      }
      setViewport(nextViewport)
      setZoom(Number(nextViewport.zoom.toFixed(2)))
      event.preventDefault()
    },
    [isPanMode, setZoom],
  )

  const handlePanPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId === event.pointerId) {
      panStartRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handlePanMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanMode || event.button !== 0) return
      mousePanStartRef.current = { x: event.clientX, y: event.clientY, viewport }
      event.preventDefault()
    },
    [isPanMode, viewport],
  )

  const handlePanMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const start = mousePanStartRef.current
      if (!isPanMode || !start) return
      const nextViewport = {
        x: start.viewport.x + event.clientX - start.x,
        y: start.viewport.y + event.clientY - start.y,
        zoom: start.viewport.zoom,
      }
      setViewport(nextViewport)
      setZoom(Number(nextViewport.zoom.toFixed(2)))
      event.preventDefault()
    },
    [isPanMode, setZoom],
  )

  const handlePanMouseUp = useCallback(() => {
    mousePanStartRef.current = null
  }, [])

  return (
    <div
      className={`relative h-full overflow-hidden rounded-md border border-[#E5E7EB] bg-white ${isConnectorMode ? 'connector-active' : ''} ${isAutoPanActive ? 'cursor-grab active:cursor-grabbing' : isShapeMode ? 'cursor-crosshair' : ''}`}
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
        onNodeClick={isPanMode ? undefined : handleNodeClick}
        onEdgeClick={isPanMode ? undefined : handleEdgeClick}
        onNodeMouseEnter={isPanMode ? undefined : handleNodeMouseEnter}
        onNodeMouseLeave={isPanMode ? undefined : handleNodeMouseLeave}
        onPaneClick={isPanMode ? undefined : handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onViewportChange={handleViewportChange}
        onInit={(instance) => {
          flowRef.current = instance
        }}
        viewport={viewport}
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.8}
        nodesDraggable={!isPanMode}
        nodesConnectable={isConnectorMode}
        elementsSelectable={!isPanMode}
        panOnDrag={isAutoPanActive}
        panOnScroll
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
      {isConnectorMode && connectorSourceNodeId && (
        <div className="pointer-events-none absolute left-4 top-4 z-40 rounded-md border border-[#C7B9FF] bg-white/95 px-3 py-2 text-[12px] font-semibold text-[#6336F1] shadow-sm">
          Click another block to connect from this block
        </div>
      )}
      {isPanMode && (
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
