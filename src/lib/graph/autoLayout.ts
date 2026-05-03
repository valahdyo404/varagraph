import type { DiagramNode, GraphModel, Swimlane } from "../../types/graph"

export const laneColors = ["#F0E8FF", "#EAF2FF", "#E8F8F4", "#FFF0E6", "#F8E8F6"]
export const laneWidth = 220
export const laneGap = 0
export const laneStartX = 0
export const nodeWidth = 152
export const nodeOffsetX = 34
export const nodeStartY = 136
export const nodeGapY = 180
const nodeTextLineHeight = 16
const nodeVerticalPadding = 26
const nodeMinHeight = 62
const decisionNodeHeight = 124
const nodeTextLineCapacity = 15

const fallbackLane: Swimlane = {
  id: "lane-1",
  title: "Lane 1",
  color: laneColors[0],
  x: 0,
  width: laneWidth,
}

export const ensureLaneInvariant = (graph: GraphModel): GraphModel => {
  if (graph.lanes.length > 0 || graph.nodes.length === 0) return graph
  return { ...graph, lanes: [fallbackLane] }
}

export const normalizeLanes = (lanes: Swimlane[]): Swimlane[] =>
  lanes.map((lane, index) => ({
    ...lane,
    color: lane.color || laneColors[index % laneColors.length],
    x: laneStartX + index * (laneWidth + laneGap),
    width: laneWidth,
  }))

export const getSafeLaneId = (lanes: Swimlane[], laneId: string): string => {
  if (lanes.some((lane) => lane.id === laneId)) return laneId
  return lanes[0]?.id ?? ""
}

export const nodeXForLane = (lane: Swimlane): number => lane.x + nodeOffsetX

const estimateTextLineCount = (label: string): number => {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1

  let lines = 1
  let currentLineLength = 0
  words.forEach((word) => {
    const nextLength = currentLineLength === 0 ? word.length : currentLineLength + 1 + word.length
    if (nextLength > nodeTextLineCapacity && currentLineLength > 0) {
      lines += 1
      currentLineLength = word.length
      return
    }
    currentLineLength = nextLength
  })

  return Math.min(lines, 3)
}

export const estimateNodeHeight = (node: DiagramNode): number => {
  if (node.data.variant === "decision") return decisionNodeHeight
  return Math.max(nodeMinHeight, estimateTextLineCount(node.data.label) * nodeTextLineHeight + nodeVerticalPadding)
}

const hasPath = (fromId: string, toId: string, edges: GraphModel["edges"], ignoredEdgeId: string): boolean => {
  const queue = [fromId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || visited.has(id)) continue
    if (id === toId) return true
    visited.add(id)
    edges.forEach((edge) => {
      if (edge.id !== ignoredEdgeId && edge.source === id) queue.push(edge.target)
    })
  }

  return false
}

const getAutoLayoutRows = (graph: GraphModel, lanes: Swimlane[]): Map<string, number> => {
  const rowById = new Map(graph.nodes.map((node) => [node.id, 0]))
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const laneIndexById = new Map(lanes.map((lane, index) => [lane.id, index]))
  const nodeOrderById = new Map(graph.nodes.map((node, index) => [node.id, index]))
  const connectedNodeIds = new Set<string>()

  const applyEdgeConstraints = (): boolean => {
    let changed = false

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sourceRow = rowById.get(edge.source)
      const targetRow = rowById.get(edge.target)
      if (!source || !target || sourceRow === undefined || targetRow === undefined) return

      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
      if (hasPath(edge.target, edge.source, graph.edges, edge.id)) return

      const sourceLaneIndex = laneIndexById.get(source.data.laneId) ?? 0
      const targetLaneIndex = laneIndexById.get(target.data.laneId) ?? sourceLaneIndex
      const isSameLane = sourceLaneIndex === targetLaneIndex
      const sourceOrder = nodeOrderById.get(edge.source) ?? 0
      const targetOrder = nodeOrderById.get(edge.target) ?? 0
      if (isSameLane && source.data.variant === "decision" && targetOrder < sourceOrder) return

      if (!isSameLane && source.data.variant === "decision") {
        if (targetRow === sourceRow) return

        rowById.set(edge.target, sourceRow)
        changed = true
        return
      }

      const nextRow = sourceRow + (isSameLane ? 1 : 0)
      if (targetRow >= nextRow) return

      rowById.set(edge.target, nextRow)
      changed = true
    })

    return changed
  }

  const getDecisionCrossLaneRows = (): Map<string, number> => {
    const rows = new Map<string, number>()

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sourceRow = rowById.get(edge.source)
      if (!source || !target || sourceRow === undefined) return
      if (hasPath(edge.target, edge.source, graph.edges, edge.id)) return

      const sourceLaneIndex = laneIndexById.get(source.data.laneId) ?? 0
      const targetLaneIndex = laneIndexById.get(target.data.laneId) ?? sourceLaneIndex
      if (sourceLaneIndex === targetLaneIndex || source.data.variant !== "decision") return

      rows.set(edge.target, sourceRow)
    })

    return rows
  }

  const applyLaneCollisions = (): boolean => {
    let changed = false
    const occupiedRowsByLaneId = new Map<string, Set<number>>()
    const decisionCrossLaneRows = getDecisionCrossLaneRows()
    const nodes = [...graph.nodes].sort((left, right) => {
      const leftPinned = decisionCrossLaneRows.has(left.id)
      const rightPinned = decisionCrossLaneRows.has(right.id)
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1
      if (leftPinned && rightPinned) return (decisionCrossLaneRows.get(left.id) ?? 0) - (decisionCrossLaneRows.get(right.id) ?? 0)
      return (nodeOrderById.get(left.id) ?? 0) - (nodeOrderById.get(right.id) ?? 0)
    })

    nodes.forEach((node) => {
      const laneId = getSafeLaneId(lanes, node.data.laneId)
      let row = decisionCrossLaneRows.get(node.id) ?? rowById.get(node.id) ?? 0
      let occupiedRows = occupiedRowsByLaneId.get(laneId)
      if (!occupiedRows) {
        occupiedRows = new Set()
        occupiedRowsByLaneId.set(laneId, occupiedRows)
      }

      while (occupiedRows.has(row)) row += 1
      occupiedRows.add(row)
      if (row === rowById.get(node.id)) return

      rowById.set(node.id, row)
      changed = true
    })

    return changed
  }

  for (let index = 0; index < graph.nodes.length; index += 1) {
    if (!applyEdgeConstraints()) break
  }

  let nextRow = Math.max(0, ...rowById.values()) + 1
  graph.nodes.forEach((node) => {
    if (connectedNodeIds.has(node.id)) return

    rowById.set(node.id, nextRow)
    nextRow += 1
  })

  const maxIterations = Math.max(1, graph.nodes.length * graph.nodes.length)
  for (let index = 0; index < maxIterations; index += 1) {
    const edgeChanged = applyEdgeConstraints()
    const collisionChanged = applyLaneCollisions()
    if (!edgeChanged && !collisionChanged) break
  }

  return rowById
}

export const autoLayoutGraph = (graph: GraphModel): GraphModel => {
  const safeGraph = ensureLaneInvariant(graph)
  const lanes = normalizeLanes(safeGraph.lanes)
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]))
  const rowById = getAutoLayoutRows(safeGraph, lanes)

  const nodes: DiagramNode[] = safeGraph.nodes.map((node) => {
    const laneId = getSafeLaneId(lanes, node.data.laneId)
    const lane = laneById.get(laneId)
    const row = rowById.get(node.id) ?? 0

    return {
      ...node,
      position: {
        x: lane ? nodeXForLane(lane) : laneStartX,
        y: nodeStartY + row * nodeGapY - estimateNodeHeight(node) / 2,
      },
      data: {
        ...node.data,
        laneId,
      },
    }
  })

  return { ...safeGraph, lanes, nodes }
}

export const laneIdFromPosition = (lanes: Swimlane[], x: number): string => {
  const lane = lanes.find((item) => x >= item.x && x < item.x + item.width)
  return lane?.id ?? lanes[0]?.id ?? ""
}

export const laneIdFromNodeCenter = (lanes: Swimlane[], x: number): string => laneIdFromPosition(lanes, x + nodeWidth / 2)
