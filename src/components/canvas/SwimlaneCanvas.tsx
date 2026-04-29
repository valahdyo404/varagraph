import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
  ReactFlow,
  ViewportPortal,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'
import type { DiagramNodeData } from '../../types/graph'
import { useEditorStore } from '../../store/editorStore'
import { LaneBackgrounds } from './LaneBackgrounds'
import { nodeWidth } from '../../lib/graph/autoLayout'
import { SwimlaneNode } from './SwimlaneNode'

const nodeTypes = { diagramNode: SwimlaneNode }

export function SwimlaneCanvas() {
  const graph = useEditorStore((state) => state.graph)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const selectedLaneId = useEditorStore((state) => state.selectedLaneId)
  const showGrid = useEditorStore((state) => state.showGrid)
  const activeTool = useEditorStore((state) => state.activeTool)
  const flowRef = useRef<ReactFlowInstance<Node<DiagramNodeData>, Edge> | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.75 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; viewport: Viewport } | null>(null)
  const mousePanStartRef = useRef<{ x: number; y: number; viewport: Viewport } | null>(null)
  const selectNode = useEditorStore((state) => state.selectNode)
  const selectLane = useEditorStore((state) => state.selectLane)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const moveNodeToPosition = useEditorStore((state) => state.moveNodeToPosition)
  const addLane = useEditorStore((state) => state.addLane)
  const deleteLane = useEditorStore((state) => state.deleteLane)
  const canDeleteLane = useEditorStore((state) => state.canDeleteLane)
  const setZoom = useEditorStore((state) => state.setZoom)
  const isPanMode = activeTool === 'Pan'
  const isAutoPanActive = isPanMode || hoveredNodeId === null

  const nodes = useMemo<Node<DiagramNodeData>[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        selected: node.id === selectedNodeId,
        className: isPanMode ? 'pointer-events-none' : 'swimlane-diagram-node',
      })),
    [graph.nodes, selectedNodeId, isPanMode],
  )

  const edges = useMemo<Edge[]>(() => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    return graph.edges.map((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sameLane = source?.data.laneId === target?.data.laneId
      const targetIsLeft = (target?.position.x ?? 0) < (source?.position.x ?? 0)
      const targetIsAbove = (target?.position.y ?? 0) < (source?.position.y ?? 0)
      const sourceHandle = sameLane ? (targetIsAbove ? 'top-source' : 'bottom-source') : targetIsLeft ? 'left-source' : 'right-source'
      const targetHandle = sameLane ? (targetIsAbove ? 'bottom-target' : 'top-target') : targetIsLeft ? 'right-target' : 'left-target'

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
        style: { stroke: '#94A3B8', strokeWidth: 1.5 },
        labelStyle: { fill: '#334155', fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.92 },
      }
    })
  }, [graph.edges, graph.nodes])

  const nodeCountsByLane = useMemo(() => {
    const counts = new Map<string, number>()
    graph.nodes.forEach((node) => counts.set(node.data.laneId, (counts.get(node.data.laneId) ?? 0) + 1))
    return counts
  }, [graph.nodes])

  const canvasHeight = useMemo(() => Math.max(1048, ...graph.nodes.map((node) => node.position.y + 180)), [graph.nodes])

  const handleNodeClick = useCallback<NodeMouseHandler>((_, node) => selectNode(node.id), [selectNode])

  const handleNodeMouseEnter = useCallback<NodeMouseHandler>((_, node) => setHoveredNodeId(node.id), [])

  const handleNodeMouseLeave = useCallback<NodeMouseHandler>(() => setHoveredNodeId(null), [])

  const handlePaneClick = useCallback(() => clearSelection(), [clearSelection])

  const handleNodeDragStop = useCallback<OnNodeDrag<Node<DiagramNodeData>>>(
    (_, node) => moveNodeToPosition(node.id, node.position),
    [moveNodeToPosition],
  )

  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    setViewport(nextViewport)
    setZoom(Number(nextViewport.zoom.toFixed(2)))
  }, [setZoom])

  const handlePanPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanMode || event.button !== 0 || !flowRef.current) return
      const viewport = flowRef.current.getViewport()
      panStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport }
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
      className={`relative h-full overflow-hidden rounded-md border border-[#E5E7EB] bg-white ${isAutoPanActive ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
        onNodeMouseEnter={isPanMode ? undefined : handleNodeMouseEnter}
        onNodeMouseLeave={isPanMode ? undefined : handleNodeMouseLeave}
        onPaneClick={isPanMode ? undefined : handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onViewportChange={handleViewportChange}
        onInit={(instance) => {
          flowRef.current = instance
        }}
        viewport={viewport}
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.8}
        nodesDraggable={!isPanMode}
        nodesConnectable={false}
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
          />
        </ViewportPortal>
        {showGrid && <Background color="#D8DEE9" gap={16} size={0.8} variant={BackgroundVariant.Dots} />}
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
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
