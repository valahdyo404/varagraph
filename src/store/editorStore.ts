import { create } from "zustand"
import type { DiagramNodeStyle, GraphModel } from "../types/graph"
import type { CanvasTool } from "../components/toolbar/CanvasToolbar"
import { autoLayoutGraph, laneColors, laneIdFromNodeCenter, nodeXForLane, normalizeLanes } from "../lib/graph/autoLayout"
import { exportGraphJson } from "../lib/graph/exportGraph"
import { defaultMermaid } from "../lib/mermaid/defaultMermaid"
import { parseMermaidSubset } from "../lib/mermaid/parseMermaidSubset"

const fallbackGraph: GraphModel = {
  lanes: [],
  nodes: [],
  edges: [],
}

const initialParse = parseMermaidSubset(defaultMermaid)
const initialGraph = initialParse.ok ? initialParse.graph : fallbackGraph

const createLaneId = (graph: GraphModel): string => {
  const ids = new Set(graph.lanes.map((lane) => lane.id))
  let index = graph.lanes.length + 1
  let id = `lane-${index}`
  while (ids.has(id)) {
    index += 1
    id = `lane-${index}`
  }
  return id
}

type EditorStore = {
  mermaidSource: string
  graph: GraphModel
  selectedNodeId: string | null
  selectedLaneId: string | null
  showGrid: boolean
  zoom: number
  activeTool: CanvasTool
  importError: string | null
  importMermaid: (source: string) => boolean
  clearMermaid: () => void
  resetMermaid: () => void
  clearSelection: () => void
  selectNode: (nodeId: string | null) => void
  selectLane: (laneId: string | null) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodeLane: (nodeId: string, laneId: string) => void
  moveNodeToPosition: (nodeId: string, position: { x: number; y: number }) => void
  moveNodeToLane: (nodeId: string, laneId: string) => void
  updateNodeLabel: (nodeId: string, label: string) => void
  updateNodeStyle: (nodeId: string, style: DiagramNodeStyle) => void
  resetNodeStyle: (nodeId: string) => void
  addLane: (title?: string) => void
  deleteLane: (laneId: string) => void
  updateLaneTitle: (laneId: string, title: string) => void
  updateLaneColor: (laneId: string, color: string) => void
  canDeleteLane: (laneId: string) => boolean
  toggleGrid: () => void
  setZoom: (zoom: number) => void
  setActiveTool: (tool: CanvasTool) => void
  autoLayoutGraph: () => void
  exportJson: () => string
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  mermaidSource: defaultMermaid,
  graph: initialGraph,
  selectedNodeId: null,
  selectedLaneId: null,
  showGrid: true,
  zoom: 1,
  activeTool: "Select",
  importError: initialParse.ok ? null : initialParse.error.message,
  importMermaid: (source) => {
    const result = parseMermaidSubset(source)
    if (!result.ok) {
      set({ importError: result.error.message })
      return false
    }

    set({
      mermaidSource: source,
      graph: autoLayoutGraph(result.graph),
      selectedNodeId: null,
      selectedLaneId: null,
      importError: null,
    })
    return true
  },
  clearMermaid: () => set({ mermaidSource: "", importError: null }),
  resetMermaid: () => {
    const result = parseMermaidSubset(defaultMermaid)
    set({
      mermaidSource: defaultMermaid,
      graph: result.ok ? autoLayoutGraph(result.graph) : fallbackGraph,
      selectedNodeId: null,
      selectedLaneId: null,
      importError: result.ok ? null : result.error.message,
    })
  },
  clearSelection: () => set({ selectedNodeId: null, selectedLaneId: null }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedLaneId: null }),
  selectLane: (laneId) => set({ selectedLaneId: laneId, selectedNodeId: null }),
  updateNodePosition: (nodeId, position) => get().moveNodeToPosition(nodeId, position),
  updateNodeLane: (nodeId, laneId) => get().moveNodeToLane(nodeId, laneId),
  moveNodeToPosition: (nodeId, position) => {
    const graph = get().graph
    const lanes = normalizeLanes(graph.lanes)
    const laneId = laneIdFromNodeCenter(lanes, position.x)
    const lane = lanes.find((item) => item.id === laneId) ?? lanes[0]
    if (!lane) return

    set({
      graph: {
        ...graph,
        lanes,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                position: { x: nodeXForLane(lane), y: position.y },
                data: { ...node.data, laneId: lane.id },
              }
            : node,
        ),
      },
    })
  },
  moveNodeToLane: (nodeId, laneId) => {
    const graph = get().graph
    const lanes = normalizeLanes(graph.lanes)
    const lane = lanes.find((item) => item.id === laneId)
    if (!lane) return

    set({
      graph: {
        ...graph,
        lanes,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                position: { ...node.position, x: nodeXForLane(lane) },
                data: { ...node.data, laneId: lane.id },
              }
            : node,
        ),
      },
    })
  },
  updateNodeLabel: (nodeId, label) => {
    const graph = get().graph
    set({
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, label } } : node,
        ),
      },
    })
  },
  updateNodeStyle: (nodeId, style) => {
    const graph = get().graph
    set({
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, style: { ...node.data.style, ...style } } }
            : node,
        ),
      },
    })
  },
  resetNodeStyle: (nodeId) => {
    const graph = get().graph
    set({
      graph: {
        ...graph,
        nodes: graph.nodes.map((node) => {
          if (node.id !== nodeId) return node
          return {
            ...node,
            data: {
              label: node.data.label,
              laneId: node.data.laneId,
              variant: node.data.variant,
            },
          }
        }),
      },
    })
  },
  addLane: (title) => {
    const graph = get().graph
    const id = createLaneId(graph)
    const lane = {
      id,
      title: title?.trim() || `Lane ${graph.lanes.length + 1}`,
      color: laneColors[graph.lanes.length % laneColors.length],
      x: 0,
      width: 240,
    }

    set({
      graph: autoLayoutGraph({ ...graph, lanes: [...graph.lanes, lane] }),
      selectedLaneId: id,
      selectedNodeId: null,
    })
  },
  canDeleteLane: (laneId) => {
    const graph = get().graph
    if (graph.lanes.length <= 1) return false
    return !graph.nodes.some((node) => node.data.laneId === laneId)
  },
  deleteLane: (laneId) => {
    const graph = get().graph
    if (!get().canDeleteLane(laneId)) return

    set((state) => ({
      graph: autoLayoutGraph({
        ...state.graph,
        lanes: state.graph.lanes.filter((lane) => lane.id !== laneId),
      }),
      selectedLaneId: state.selectedLaneId === laneId ? null : state.selectedLaneId,
    }))
  },
  updateLaneTitle: (laneId, title) => {
    const graph = get().graph
    set({
      graph: {
        ...graph,
        lanes: graph.lanes.map((lane) =>
          lane.id === laneId ? { ...lane, title: title.trim() || "Untitled lane" } : lane,
        ),
      },
    })
  },
  updateLaneColor: (laneId, color) => {
    const graph = get().graph
    set({
      graph: {
        ...graph,
        lanes: graph.lanes.map((lane) => (lane.id === laneId ? { ...lane, color } : lane)),
      },
    })
  },
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setZoom: (zoom) => set({ zoom }),
  setActiveTool: (activeTool) => set({ activeTool }),
  autoLayoutGraph: () => set((state) => ({ graph: autoLayoutGraph(state.graph) })),
  exportJson: () => exportGraphJson(get().graph),
}))
