import { create } from "zustand"
import type { DiagramEdgeArrow, DiagramNodeStyle, DiagramNodeVariant, GraphModel, Swimlane } from "../types/graph"
import type { CanvasTool } from "../components/toolbar/CanvasToolbar"
import { autoLayoutGraph, laneColors, laneIdFromNodeCenter, nodeGapY, nodeStartY, nodeXForLane, normalizeLanes } from "../lib/graph/autoLayout"
import { exportGraphJson, exportGraphMermaid } from "../lib/graph/exportGraph"
import { defaultMermaid } from "../lib/mermaid/defaultMermaid"
import { parseMermaidSubset } from "../lib/mermaid/parseMermaidSubset"

const draftStorageKey = "varagraph:draft:v1"
const maxHistory = 60

const fallbackGraph: GraphModel = {
  lanes: [],
  nodes: [],
  edges: [],
}

const initialParse = parseMermaidSubset(defaultMermaid)
const starterGraph = initialParse.ok ? initialParse.graph : fallbackGraph

type StoredDraft = {
  graph?: GraphModel
  mermaidSource?: string
}

const hasWindow = () => typeof window !== "undefined" && Boolean(window.localStorage)

const safeCloneGraph = (graph: GraphModel): GraphModel => JSON.parse(JSON.stringify(graph)) as GraphModel

const isGraphModel = (value: unknown): value is GraphModel => {
  const graph = value as GraphModel
  return Boolean(graph && Array.isArray(graph.lanes) && Array.isArray(graph.nodes) && Array.isArray(graph.edges))
}

const loadStoredDraft = (): StoredDraft | null => {
  if (!hasWindow()) return null
  try {
    const raw = window.localStorage.getItem(draftStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    return parsed && isGraphModel(parsed.graph) ? parsed : null
  } catch {
    return null
  }
}

const persistDraft = (graph: GraphModel, mermaidSource: string) => {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ graph, mermaidSource }))
  } catch {
    // Persistence is best-effort and should never block editing.
  }
}

const storedDraft = loadStoredDraft()
const initialGraph = storedDraft?.graph ? storedDraft.graph : starterGraph
const initialMermaidSource = storedDraft?.mermaidSource ?? defaultMermaid

const createUniqueId = (existingIds: Iterable<string>, prefix: string): string => {
  const ids = new Set(existingIds)
  let index = ids.size + 1
  let id = `${prefix}-${index}`
  while (ids.has(id)) {
    index += 1
    id = `${prefix}-${index}`
  }
  return id
}

const createLaneId = (graph: GraphModel): string => createUniqueId(graph.lanes.map((lane) => lane.id), "lane")
const createNodeId = (graph: GraphModel): string => createUniqueId(graph.nodes.map((node) => node.id), "node")
const createEdgeId = (graph: GraphModel): string => createUniqueId(graph.edges.map((edge) => edge.id), "edge")

const sanitizeGraph = (graph: GraphModel): GraphModel => {
  const lanes = normalizeLanes(graph.lanes)
  const laneIds = new Set(lanes.map((lane) => lane.id))
  const fallbackLaneId = lanes[0]?.id ?? ""
  const nodes = graph.nodes.map((node) => ({
    ...node,
    type: "diagramNode" as const,
    data: {
      ...node.data,
      label: node.data.label || "Untitled",
      laneId: laneIds.has(node.data.laneId) ? node.data.laneId : fallbackLaneId,
      variant: node.data.variant ?? "process",
    },
  }))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = graph.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      ...edge,
      type: "smoothstep" as const,
      label: edge.label ?? edge.data?.label,
      data: {
        ...edge.data,
        label: edge.label ?? edge.data?.label,
        arrowDirection: edge.data?.arrowDirection ?? "forward",
      },
    }))

  return { lanes, nodes, edges }
}

const parseJsonGraph = (json: string): GraphModel | null => {
  try {
    const parsed = JSON.parse(json) as {
      lanes?: GraphModel["lanes"]
      nodes?: Array<{
        id: string
        label?: string
        variant?: DiagramNodeVariant
        laneId?: string
        position?: { x: number; y: number }
        style?: DiagramNodeStyle
        data?: { label?: string; laneId?: string; variant?: DiagramNodeVariant; style?: DiagramNodeStyle }
        type?: "diagramNode"
      }>
      edges?: Array<{
        id: string
        source: string
        target: string
        label?: string
        arrowDirection?: DiagramEdgeArrow
        sourceHandle?: string
        targetHandle?: string
        data?: { label?: string; arrowDirection?: DiagramEdgeArrow }
      }>
    }
    if (!Array.isArray(parsed.lanes) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null

    const lanes: Swimlane[] = parsed.lanes.map((lane, index) => ({
      id: String(lane.id || `lane-${index + 1}`),
      title: lane.title || `Lane ${index + 1}`,
      color: lane.color || laneColors[index % laneColors.length],
      x: Number(lane.x) || 0,
      width: Number(lane.width) || 220,
    }))

    const graph: GraphModel = {
      lanes,
      nodes: parsed.nodes.map((node, index) => ({
        id: String(node.id || `node-${index + 1}`),
        type: "diagramNode",
        position: node.position ?? { x: 0, y: nodeStartY + index * nodeGapY },
        data: {
          label: node.label ?? node.data?.label ?? "Untitled",
          laneId: node.laneId ?? node.data?.laneId ?? lanes[0]?.id ?? "",
          variant: node.variant ?? node.data?.variant ?? "process",
          style: node.style ?? node.data?.style,
        },
      })),
      edges: parsed.edges.map((edge, index) => ({
        id: String(edge.id || `edge-${index + 1}`),
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: "smoothstep",
        label: edge.label ?? edge.data?.label,
        data: {
          label: edge.label ?? edge.data?.label,
          arrowDirection: edge.arrowDirection ?? edge.data?.arrowDirection ?? "forward",
        },
      })),
    }

    return sanitizeGraph(graph)
  } catch {
    return null
  }
}

type CommitSelection = Partial<Pick<EditorStore, "selectedNodeId" | "selectedEdgeId" | "selectedLaneId" | "laneDeleteMessage" | "laneDeleteTargetId" | "importError">>

type EditorStore = {
  mermaidSource: string
  graph: GraphModel
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedLaneId: string | null
  laneDeleteMessage: string | null
  laneDeleteTargetId: string | null
  showGrid: boolean
  zoom: number
  activeTool: CanvasTool
  pendingEdgeArrowDirection: DiagramEdgeArrow
  importError: string | null
  canUndo: boolean
  canRedo: boolean
  past: GraphModel[]
  future: GraphModel[]
  importMermaid: (source: string) => boolean
  importJson: (json: string) => boolean
  clearMermaid: () => void
  resetMermaid: () => void
  clearSelection: () => void
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  selectLane: (laneId: string | null) => void
  addNode: (input?: { laneId?: string; variant?: DiagramNodeVariant; label?: string; position?: { x: number; y: number } }) => string
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodeLane: (nodeId: string, laneId: string) => void
  moveNodeToPosition: (nodeId: string, position: { x: number; y: number }) => void
  moveNodeToLane: (nodeId: string, laneId: string) => void
  updateNodeLabel: (nodeId: string, label: string) => void
  updateNodeVariant: (nodeId: string, variant: DiagramNodeVariant) => void
  updateNodeStyle: (nodeId: string, style: DiagramNodeStyle) => void
  resetNodeStyle: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  addEdge: (input: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; label?: string; arrowDirection?: DiagramEdgeArrow }) => string | null
  updateEdgeLabel: (edgeId: string, label: string) => void
  updateEdgeArrowDirection: (edgeId: string, arrowDirection: DiagramEdgeArrow) => void
  reverseEdgeDirection: (edgeId: string) => void
  deleteEdge: (edgeId: string) => void
  deleteSelection: () => void
  addLane: (title?: string) => string
  deleteLane: (laneId: string) => boolean
  updateLaneTitle: (laneId: string, title: string) => void
  updateLaneColor: (laneId: string, color: string) => void
  canDeleteLane: (laneId: string) => boolean
  toggleGrid: () => void
  setZoom: (zoom: number) => void
  setActiveTool: (tool: CanvasTool) => void
  setPendingEdgeArrowDirection: (arrowDirection: DiagramEdgeArrow) => void
  autoLayoutGraph: () => void
  undo: () => void
  redo: () => void
  exportJson: () => string
  exportMermaid: () => string
}

const commitGraph = (
  set: (partial: Partial<EditorStore> | ((state: EditorStore) => Partial<EditorStore>)) => void,
  get: () => EditorStore,
  graph: GraphModel,
  selection: CommitSelection = {},
) => {
  const state = get()
  const nextGraph = sanitizeGraph(graph)
  const past = [...state.past, safeCloneGraph(state.graph)].slice(-maxHistory)
  persistDraft(nextGraph, state.mermaidSource)
  set({
    graph: nextGraph,
    past,
    future: [],
    canUndo: past.length > 0,
    canRedo: false,
    ...selection,
  })
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  mermaidSource: initialMermaidSource,
  graph: sanitizeGraph(initialGraph),
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedLaneId: null,
  laneDeleteMessage: null,
  laneDeleteTargetId: null,
  showGrid: true,
  zoom: 1,
  activeTool: "Select",
  pendingEdgeArrowDirection: "forward",
  importError: initialParse.ok ? null : initialParse.error.message,
  canUndo: false,
  canRedo: false,
  past: [],
  future: [],
  importMermaid: (source) => {
    const result = parseMermaidSubset(source)
    if (!result.ok) {
      set({ importError: result.error.message })
      return false
    }

    const graph = autoLayoutGraph(result.graph)
    persistDraft(graph, source)
    commitGraph(set, get, graph, {
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedLaneId: null,
      laneDeleteMessage: null,
      laneDeleteTargetId: null,
      importError: null,
    })
    set({ mermaidSource: source })
    persistDraft(graph, source)
    return true
  },
  importJson: (json) => {
    const graph = parseJsonGraph(json)
    if (!graph) {
      set({ importError: "JSON import failed: expected a Varagraph export with lanes, nodes, and edges." })
      return false
    }
    commitGraph(set, get, graph, {
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedLaneId: null,
      laneDeleteMessage: null,
      laneDeleteTargetId: null,
      importError: null,
    })
    return true
  },
  clearMermaid: () => set({ mermaidSource: "", importError: null }),
  resetMermaid: () => {
    const result = parseMermaidSubset(defaultMermaid)
    const graph = result.ok ? autoLayoutGraph(result.graph) : fallbackGraph
    set({ mermaidSource: defaultMermaid })
    commitGraph(set, get, graph, {
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedLaneId: null,
      laneDeleteMessage: null,
      laneDeleteTargetId: null,
      importError: result.ok ? null : result.error.message,
    })
  },
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null, selectedLaneId: null, laneDeleteMessage: null, laneDeleteTargetId: null }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null, selectedLaneId: null, laneDeleteMessage: null, laneDeleteTargetId: null }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null, selectedLaneId: null, laneDeleteMessage: null, laneDeleteTargetId: null }),
  selectLane: (laneId) => set({ selectedLaneId: laneId, selectedNodeId: null, selectedEdgeId: null, laneDeleteMessage: null, laneDeleteTargetId: null }),
  addNode: (input = {}) => {
    const graph = get().graph
    const lanes = normalizeLanes(graph.lanes)
    const positionLaneId = input.position ? laneIdFromNodeCenter(lanes, input.position.x) : undefined
    const lane = lanes.find((item) => item.id === (input.laneId ?? positionLaneId)) ?? lanes[0]
    const id = createNodeId(graph)
    if (!lane) return id
    const laneNodeCount = graph.nodes.filter((node) => node.data.laneId === lane.id).length
    const node = {
      id,
      type: "diagramNode" as const,
      position: input.position ? { x: nodeXForLane(lane), y: input.position.y } : { x: nodeXForLane(lane), y: nodeStartY + laneNodeCount * nodeGapY },
      data: {
        label: input.label ?? "New step",
        laneId: lane.id,
        variant: input.variant ?? "process",
      },
    }
    commitGraph(set, get, { ...graph, lanes, nodes: [...graph.nodes, node] }, { selectedNodeId: id, selectedEdgeId: null, selectedLaneId: null })
    return id
  },
  updateNodePosition: (nodeId, position) => get().moveNodeToPosition(nodeId, position),
  updateNodeLane: (nodeId, laneId) => get().moveNodeToLane(nodeId, laneId),
  moveNodeToPosition: (nodeId, position) => {
    const graph = get().graph
    const lanes = normalizeLanes(graph.lanes)
    const laneId = laneIdFromNodeCenter(lanes, position.x)
    const lane = lanes.find((item) => item.id === laneId) ?? lanes[0]
    if (!lane) return

    commitGraph(set, get, {
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
    })
  },
  moveNodeToLane: (nodeId, laneId) => {
    const graph = get().graph
    const lanes = normalizeLanes(graph.lanes)
    const lane = lanes.find((item) => item.id === laneId)
    if (!lane) return

    commitGraph(set, get, {
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
    })
  },
  updateNodeLabel: (nodeId, label) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, label: label.trim() || "Untitled" } } : node)),
    })
  },
  updateNodeVariant: (nodeId, variant) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, variant } } : node)),
    })
  },
  updateNodeStyle: (nodeId, style) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, style: { ...node.data.style, ...style } } } : node,
      ),
    })
  },
  resetNodeStyle: (nodeId) => {
    const graph = get().graph
    commitGraph(set, get, {
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
    })
  },
  deleteNode: (nodeId) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    }, { selectedNodeId: null, selectedEdgeId: null })
  },
  addEdge: (input) => {
    const graph = get().graph
    if (!input.source || !input.target || input.source === input.target) return null
    const nodeIds = new Set(graph.nodes.map((node) => node.id))
    if (!nodeIds.has(input.source) || !nodeIds.has(input.target)) return null
    const duplicate = graph.edges.some(
      (edge) => edge.source === input.source && edge.target === input.target && edge.sourceHandle === (input.sourceHandle ?? undefined) && edge.targetHandle === (input.targetHandle ?? undefined),
    )
    if (duplicate) return null
    const id = createEdgeId(graph)
    const label = input.label?.trim() || undefined
    const arrowDirection = input.arrowDirection ?? get().pendingEdgeArrowDirection
    commitGraph(set, get, {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id,
          source: input.source,
          target: input.target,
          sourceHandle: input.sourceHandle ?? undefined,
          targetHandle: input.targetHandle ?? undefined,
          type: "smoothstep",
          label,
          data: { label, arrowDirection },
        },
      ],
    }, { selectedEdgeId: id, selectedNodeId: null, selectedLaneId: null })
    return id
  },
  updateEdgeLabel: (edgeId, label) => {
    const graph = get().graph
    const trimmed = label.trim()
    commitGraph(set, get, {
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, label: trimmed || undefined, data: { ...edge.data, label: trimmed || undefined } } : edge,
      ),
    })
  },
  updateEdgeArrowDirection: (edgeId, arrowDirection) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, data: { ...edge.data, arrowDirection } } : edge)),
    })
  },
  reverseEdgeDirection: (edgeId) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              source: edge.target,
              target: edge.source,
              sourceHandle: edge.targetHandle,
              targetHandle: edge.sourceHandle,
              data: { ...edge.data, arrowDirection: "forward" },
            }
          : edge,
      ),
    })
  },
  deleteEdge: (edgeId) => {
    const graph = get().graph
    commitGraph(set, get, { ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) }, { selectedEdgeId: null })
  },
  deleteSelection: () => {
    const state = get()
    if (state.selectedNodeId) {
      state.deleteNode(state.selectedNodeId)
      return
    }
    if (state.selectedEdgeId) {
      state.deleteEdge(state.selectedEdgeId)
      return
    }
    if (state.selectedLaneId) state.deleteLane(state.selectedLaneId)
  },
  addLane: (title) => {
    const graph = get().graph
    const id = createLaneId(graph)
    const lane = {
      id,
      title: title?.trim() || `Lane ${graph.lanes.length + 1}`,
      color: laneColors[graph.lanes.length % laneColors.length],
      x: 0,
      width: 220,
    }
    const lanes = normalizeLanes([...graph.lanes, lane])

    commitGraph(set, get, { ...graph, lanes }, { selectedLaneId: id, selectedNodeId: null, selectedEdgeId: null, laneDeleteMessage: null, laneDeleteTargetId: null })
    return id
  },
  canDeleteLane: (laneId) => {
    const graph = get().graph
    if (graph.lanes.length <= 1) return false
    return !graph.nodes.some((node) => node.data.laneId === laneId)
  },
  deleteLane: (laneId) => {
    const graph = get().graph
    const lane = graph.lanes.find((item) => item.id === laneId)
    if (!lane) return false
    if (graph.lanes.length <= 1) {
      set({ laneDeleteMessage: "At least one lane must remain.", laneDeleteTargetId: laneId, selectedLaneId: laneId })
      return false
    }
    const nodeCount = graph.nodes.filter((node) => node.data.laneId === laneId).length
    if (nodeCount > 0) {
      set({ laneDeleteMessage: `Move or delete ${nodeCount} node${nodeCount === 1 ? "" : "s"} before deleting this lane.`, laneDeleteTargetId: laneId, selectedLaneId: laneId, selectedNodeId: null, selectedEdgeId: null })
      return false
    }

    commitGraph(set, get, autoLayoutGraph({
      ...graph,
      lanes: graph.lanes.filter((item) => item.id !== laneId),
    }), { selectedLaneId: null, laneDeleteMessage: null, laneDeleteTargetId: null })
    return true
  },
  updateLaneTitle: (laneId, title) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      lanes: graph.lanes.map((lane) => (lane.id === laneId ? { ...lane, title: title.trim() || "Untitled lane" } : lane)),
    })
  },
  updateLaneColor: (laneId, color) => {
    const graph = get().graph
    commitGraph(set, get, {
      ...graph,
      lanes: graph.lanes.map((lane) => (lane.id === laneId ? { ...lane, color } : lane)),
    })
  },
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setZoom: (zoom) => set({ zoom }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setPendingEdgeArrowDirection: (pendingEdgeArrowDirection) => set({ pendingEdgeArrowDirection }),
  autoLayoutGraph: () => commitGraph(set, get, autoLayoutGraph(get().graph)),
  undo: () => {
    const state = get()
    const previous = state.past.at(-1)
    if (!previous) return
    const past = state.past.slice(0, -1)
    const future = [safeCloneGraph(state.graph), ...state.future].slice(0, maxHistory)
    persistDraft(previous, state.mermaidSource)
    set({ graph: previous, past, future, canUndo: past.length > 0, canRedo: future.length > 0, selectedNodeId: null, selectedEdgeId: null, selectedLaneId: null, laneDeleteMessage: null, laneDeleteTargetId: null })
  },
  redo: () => {
    const state = get()
    const next = state.future[0]
    if (!next) return
    const future = state.future.slice(1)
    const past = [...state.past, safeCloneGraph(state.graph)].slice(-maxHistory)
    persistDraft(next, state.mermaidSource)
    set({ graph: next, past, future, canUndo: past.length > 0, canRedo: future.length > 0, selectedNodeId: null, selectedEdgeId: null, selectedLaneId: null, laneDeleteMessage: null, laneDeleteTargetId: null })
  },
  exportJson: () => exportGraphJson(get().graph),
  exportMermaid: () => exportGraphMermaid(get().graph),
}))
