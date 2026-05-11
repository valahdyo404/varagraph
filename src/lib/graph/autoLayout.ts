import type { DiagramNode, GraphModel, Swimlane } from "../../types/graph"
import {
  anchorForDirection,
  buildOrthogonalRoute,
  directionFromHandle,
  inferEdgeHandles,
  isLateralCrossLane,
  lateralSideTargetCorridorIsBlocked,
  pathIntersectsBounds,
  preferRouteAxis,
  resolveEdgeHandles,
  type AnchorDirection,
  type RouteBounds,
} from "./orthogonalRouting"

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
const decisionSize = 108
const decisionOffsetX = (nodeWidth - decisionSize) / 2
const decisionOffsetY = 8
const decisionVisualRadius = (Math.sqrt(2) * decisionSize) / 2
const maxBlockAvoidanceNodes = 150
const maxBlockAvoidanceEdges = 300

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

const layoutBoundsForNode = (node: DiagramNode, lane: Swimlane, row: number): RouteBounds => {
  const x = nodeXForLane(lane)
  const y = nodeStartY + row * nodeGapY - estimateNodeHeight(node) / 2

  if (node.data.variant === "decision") {
    const left = x + decisionOffsetX
    const top = y + decisionOffsetY
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
  return {
    center: { x: x + nodeWidth / 2, y: y + height / 2 },
    left: x,
    right: x + nodeWidth,
    top: y,
    bottom: y + height,
  }
}

const bottomCorridorOffset = (sourceBounds: RouteBounds, targetBounds: RouteBounds, allBounds: RouteBounds[], sameLane: boolean): number | undefined => {
  if (sameLane || targetBounds.center.y >= sourceBounds.center.y - 80) return undefined

  const maxBottom = Math.max(...allBounds.map((bounds) => bounds.bottom))
  if (sourceBounds.bottom < maxBottom - 120) return undefined

  const corridorY = maxBottom + 72
  const source = anchorForDirection(sourceBounds, "bottom")
  const target = anchorForDirection(targetBounds, "bottom")
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

  const source = anchorForDirection(sourceBounds, "bottom")
  const target = anchorForDirection(targetBounds, "top")
  return corridorY - (source.y + target.y) / 2
}

const buildLayoutRoute = (
  source: DiagramNode,
  target: DiagramNode,
  edge: GraphModel["edges"][number],
  sourceBounds: RouteBounds,
  targetBounds: RouteBounds,
  blockedBounds: RouteBounds[],
  resolvedHandles?: { sourceHandle?: string; targetHandle?: string; offset?: number },
) => {
  const sameLane = source.data.laneId === target.data.laneId
  const inferredHandles = inferEdgeHandles(sourceBounds, targetBounds, sameLane)
  const sourceHandle = resolvedHandles?.sourceHandle ?? edge.sourceHandle ?? inferredHandles.sourceHandle
  const targetHandle = resolvedHandles?.targetHandle ?? edge.targetHandle ?? inferredHandles.targetHandle
  const dx = targetBounds.center.x - sourceBounds.center.x
  const dy = targetBounds.center.y - sourceBounds.center.y
  const routeVertically = Math.abs(dy) > Math.abs(dx)
  const sourceDirection = directionFromHandle(sourceHandle) ?? (routeVertically ? (dy >= 0 ? "bottom" : "top") : dx >= 0 ? "right" : "left")
  const targetDirection = directionFromHandle(targetHandle) ?? (routeVertically ? (dy >= 0 ? "top" : "bottom") : dx >= 0 ? "left" : "right")
  const isDecisionCrossLane = source.data.variant === "decision" && !sameLane
  const prefersLateralCrossLane = isLateralCrossLane(sourceBounds, targetBounds, sameLane)
  const isIncomingDecision = target.data.variant === "decision" && source.data.variant !== "decision" && Math.abs(dy) > 0.5

  if (isDecisionCrossLane) {
    return buildOrthogonalRoute({
      sourceBounds,
      targetBounds,
      blockedBounds,
      sourceDirection,
      targetDirection,
      offset: resolvedHandles?.offset,
      prefer: "horizontal",
    })
  }

  if (prefersLateralCrossLane) {
    return buildOrthogonalRoute({
      sourceBounds,
      targetBounds,
      blockedBounds,
      sourceDirection,
      targetDirection,
      offset: resolvedHandles?.offset,
      prefer: "horizontal",
    })
  }

  if (isIncomingDecision) {
    return buildOrthogonalRoute({
      sourceBounds,
      targetBounds,
      blockedBounds,
      sourceDirection,
      targetDirection,
      offset: resolvedHandles?.offset,
      prefer: preferRouteAxis(sourceDirection, targetDirection),
    })
  }

  return buildOrthogonalRoute({
    sourceBounds,
    targetBounds,
    blockedBounds,
    sourceDirection,
    targetDirection,
    offset: resolvedHandles?.offset,
    prefer: preferRouteAxis(sourceDirection, targetDirection),
  })
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
  const shouldAvoidBlocks = graph.nodes.length <= maxBlockAvoidanceNodes && graph.edges.length <= maxBlockAvoidanceEdges
  const laneIndexById = new Map(lanes.map((lane, index) => [lane.id, index]))
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]))
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

      const sourceLaneIndex = laneIndexById.get(source.data.laneId) ?? 0
      const targetLaneIndex = laneIndexById.get(target.data.laneId) ?? sourceLaneIndex
      const isSameLane = sourceLaneIndex === targetLaneIndex
      if (hasPath(edge.target, edge.source, graph.edges, edge.id) && !isSameLane) return
      const sourceOrder = nodeOrderById.get(edge.source) ?? 0
      const targetOrder = nodeOrderById.get(edge.target) ?? 0
      if (isSameLane && source.data.variant === "decision" && targetOrder < sourceOrder) return

      if (!isSameLane && source.data.variant === "decision") {
        if (targetRow >= sourceRow) return

        rowById.set(edge.target, sourceRow)
        changed = true
        return
      }

      const entersDecisionFromAbove =
        target.data.variant === "decision" &&
        (isSameLane || targetLaneIndex < sourceLaneIndex)
      const nextRow = sourceRow + (isSameLane || entersDecisionFromAbove ? 1 : 0)
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

  const getProtectedCrossLaneSources = (): Map<string, string> => {
    const sources = new Map<string, string>()
    const outgoingCountByNodeId = new Map<string, number>()
    graph.edges.forEach((edge) => {
      outgoingCountByNodeId.set(edge.source, (outgoingCountByNodeId.get(edge.source) ?? 0) + 1)
    })

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sourceRow = rowById.get(edge.source)
      if (!source || !target || sourceRow === undefined) return

      const sourceLaneIndex = laneIndexById.get(source.data.laneId) ?? 0
      const targetLaneIndex = laneIndexById.get(target.data.laneId) ?? sourceLaneIndex
      if (sourceLaneIndex === targetLaneIndex || target.data.variant === "decision") return

      const currentSourceId = sources.get(edge.target)
      const currentSourceRow = currentSourceId ? rowById.get(currentSourceId) : undefined
      const targetIsTerminal = (outgoingCountByNodeId.get(edge.target) ?? 0) === 0
      if (currentSourceRow !== undefined && (targetIsTerminal ? currentSourceRow >= sourceRow : currentSourceRow <= sourceRow)) return

      sources.set(edge.target, edge.source)
    })

    return sources
  }

  const getLockedDirectCrossLaneNodeIds = (): Set<string> => {
    const nodeIds = new Set<string>()

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      if (!source || !target) return

      const sourceLaneIndex = laneIndexById.get(source.data.laneId) ?? 0
      const targetLaneIndex = laneIndexById.get(target.data.laneId) ?? sourceLaneIndex
      if (sourceLaneIndex === targetLaneIndex) return
      if (source.data.variant === "decision" || target.data.variant === "decision") return

      nodeIds.add(edge.source)
      nodeIds.add(edge.target)
    })

    return nodeIds
  }

  const getReadabilityRowUpperBounds = (): Map<string, number> => {
    const maxRowByNodeId = new Map<string, number>()

    graph.nodes.forEach((node) => {
      const laneId = getSafeLaneId(lanes, node.data.laneId)
      const currentRow = rowById.get(node.id)
      if (currentRow === undefined) return

      graph.nodes.forEach((candidate) => {
        if (candidate.id === node.id) return
        if (getSafeLaneId(lanes, candidate.data.laneId) !== laneId) return

        const candidateRow = rowById.get(candidate.id)
        if (candidateRow === undefined || candidateRow <= currentRow) return
        if (!hasPath(node.id, candidate.id, graph.edges, "__none__")) return

        const maxRow = candidateRow - 1
        const currentMax = maxRowByNodeId.get(node.id)
        if (currentMax === undefined || maxRow < currentMax) {
          maxRowByNodeId.set(node.id, maxRow)
        }
      })
    })

    return maxRowByNodeId
  }

  const applyLaneCollisions = (): boolean => {
    let changed = false
    const occupiedRowsByLaneId = new Map<string, Set<number>>()
    const assignedRowsByNodeId = new Map<string, number>()
    const decisionCrossLaneRows = getDecisionCrossLaneRows()
    const protectedCrossLaneSources = getProtectedCrossLaneSources()
    const protectedRowForNode = (nodeId: string): number | undefined => {
      const sourceId = protectedCrossLaneSources.get(nodeId)
      if (!sourceId) return undefined
      return assignedRowsByNodeId.get(sourceId) ?? rowById.get(sourceId)
    }
    const preferredRowForNode = (node: DiagramNode): number => {
      const currentRow = rowById.get(node.id) ?? 0
      const protectedRow = protectedRowForNode(node.id)
      if (protectedRow !== undefined) return protectedRow
      const preferredCrossLaneRow = decisionCrossLaneRows.get(node.id)
      return preferredCrossLaneRow === undefined ? currentRow : Math.max(currentRow, preferredCrossLaneRow)
    }
    const preferredOrderForNode = (node: DiagramNode): number => {
      const sourceId = protectedCrossLaneSources.get(node.id)
      if (!sourceId) return nodeOrderById.get(node.id) ?? 0
      return (nodeOrderById.get(sourceId) ?? 0) + 0.5
    }

    const nodes = [...graph.nodes].sort((left, right) => {
      const rowDelta = preferredRowForNode(left) - preferredRowForNode(right)
      if (rowDelta !== 0) return rowDelta
      return preferredOrderForNode(left) - preferredOrderForNode(right)
    })

    nodes.forEach((node) => {
      const laneId = getSafeLaneId(lanes, node.data.laneId)
      const currentRow = rowById.get(node.id) ?? 0
      const protectedRow = protectedRowForNode(node.id)
      const preferredCrossLaneRow = decisionCrossLaneRows.get(node.id)
      let row = protectedRow ?? (preferredCrossLaneRow === undefined ? currentRow : Math.max(currentRow, preferredCrossLaneRow))
      let occupiedRows = occupiedRowsByLaneId.get(laneId)
      if (!occupiedRows) {
        occupiedRows = new Set()
        occupiedRowsByLaneId.set(laneId, occupiedRows)
      }

      while (occupiedRows.has(row)) row += 1
      occupiedRows.add(row)
      assignedRowsByNodeId.set(node.id, row)
      if (row === rowById.get(node.id)) return

      rowById.set(node.id, row)
      changed = true
    })

    return changed
  }

  const enforceReadableLaneOrder = (): boolean => {
    let changed = false
    const nodesByLaneId = new Map<string, DiagramNode[]>()
    const protectedCrossLaneSources = getProtectedCrossLaneSources()

    graph.nodes.forEach((node) => {
      const laneId = getSafeLaneId(lanes, node.data.laneId)
      nodesByLaneId.set(laneId, [...(nodesByLaneId.get(laneId) ?? []), node])
    })

    nodesByLaneId.forEach((laneNodes) => {
      const nodes = [...laneNodes].sort((left, right) => (nodeOrderById.get(left.id) ?? 0) - (nodeOrderById.get(right.id) ?? 0))

      nodes.forEach((source) => {
        const sourceRow = rowById.get(source.id)
        if (sourceRow === undefined) return

        nodes.forEach((target) => {
          if (target.id === source.id) return
          const targetRow = rowById.get(target.id)
          if (targetRow === undefined) return
          if (!hasPath(source.id, target.id, graph.edges, "__none__")) return
          if (hasPath(target.id, source.id, graph.edges, "__none__")) return
          if (targetRow > sourceRow) return

          rowById.set(target.id, sourceRow + 1)
          changed = true
        })
      })

      nodes.forEach((source, index) => {
        const target = nodes[index + 1]
        if (!target) return
        if (protectedCrossLaneSources.has(target.id)) return

        const sourceRow = rowById.get(source.id)
        const targetRow = rowById.get(target.id)
        if (sourceRow === undefined || targetRow === undefined) return
        if (hasPath(target.id, source.id, graph.edges, "__none__")) return
        if (targetRow > sourceRow) return

        rowById.set(target.id, sourceRow + 1)
        changed = true
      })
    })

    return changed
  }

  const boundsForRow = (node: DiagramNode): RouteBounds | undefined => {
    const lane = laneById.get(getSafeLaneId(lanes, node.data.laneId))
    const row = rowById.get(node.id)
    if (!lane || row === undefined) return undefined
    return layoutBoundsForNode(node, lane, row)
  }

  const resolveEdgeHandlesForRows = () => {
    const outerLaneSourceHandle = (laneId: string): string | undefined => {
      const laneIndex = lanes.findIndex((lane) => lane.id === laneId)
      if (laneIndex === 0) return "left-source"
      if (laneIndex === lanes.length - 1) return "right-source"
      return undefined
    }
    const preferredSameLaneSourceHandleByEdgeId = new Map<string, string>()
    graph.nodes.forEach((node) => {
      const sourceBounds = boundsForRow(node)
      if (!sourceBounds) return

      if (node.data.variant === "decision") {
        const outgoingEdges = graph.edges
          .map((edge) => ({ edge, target: nodeById.get(edge.target) }))
          .filter((entry): entry is { edge: GraphModel["edges"][number]; target: DiagramNode } => entry.edge.source === node.id && entry.target !== undefined && entry.target.data.laneId === node.data.laneId)
          .map(({ edge, target }) => ({ edge, targetBounds: boundsForRow(target) }))
          .filter((entry): entry is { edge: GraphModel["edges"][number]; targetBounds: RouteBounds } => Boolean(entry.targetBounds))
          .sort((left, right) => Math.abs(left.targetBounds.center.y - sourceBounds.center.y) - Math.abs(right.targetBounds.center.y - sourceBounds.center.y))
        outgoingEdges.forEach(({ edge, targetBounds }, index) => {
          const targetIsBelow = targetBounds.center.y >= sourceBounds.center.y
          preferredSameLaneSourceHandleByEdgeId.set(edge.id, index === 0 ? (targetIsBelow ? "bottom-source" : "top-source") : outerLaneSourceHandle(node.data.laneId) ?? "left-source")
        })
        return
      }

      const outsideHandle = outerLaneSourceHandle(node.data.laneId)
      if (!outsideHandle) return
      graph.edges.forEach((edge) => {
        const target = nodeById.get(edge.target)
        if (edge.source !== node.id || !target || target.data.laneId !== node.data.laneId) return
        const targetBounds = boundsForRow(target)
        if (!targetBounds || Math.abs(targetBounds.center.y - sourceBounds.center.y) <= 240) return
        preferredSameLaneSourceHandleByEdgeId.set(edge.id, outsideHandle)
      })
    })
    const reservedSourceDirectionsByNodeId = new Map<string, Set<AnchorDirection>>()
    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const direction = directionFromHandle(preferredSameLaneSourceHandleByEdgeId.get(edge.id))
      if (source?.data.variant !== "decision" || !direction || (direction !== "left" && direction !== "right")) return
      const reservedDirections = reservedSourceDirectionsByNodeId.get(edge.source) ?? new Set<AnchorDirection>()
      reservedDirections.add(direction)
      reservedSourceDirectionsByNodeId.set(edge.source, reservedDirections)
    })
    const outgoingCountByNodeId = new Map<string, number>()
    graph.edges.forEach((edge) => {
      outgoingCountByNodeId.set(edge.source, (outgoingCountByNodeId.get(edge.source) ?? 0) + 1)
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
      const sourceBounds = source ? boundsForRow(source) : undefined
      const targetBounds = target ? boundsForRow(target) : undefined
      if (!source || !target || !sourceBounds || !targetBounds) return
      const sameLane = source.data.laneId === target.data.laneId
      const inferredHandles = inferEdgeHandles(sourceBounds, targetBounds, sameLane)
      const decisionSourceHandle = preferredSameLaneSourceHandleByEdgeId.get(edge.id)
      const preferredSourceDirection = directionFromHandle(edge.sourceHandle ?? decisionSourceHandle)
      const preferredTargetHandle = sameLane && (preferredSourceDirection === "left" || preferredSourceDirection === "right") ? `${preferredSourceDirection}-target` : inferredHandles.targetHandle
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
      const sourceBounds = source ? boundsForRow(source) : undefined
      const targetBounds = target ? boundsForRow(target) : undefined
      if (!source || !target || !sourceBounds || !targetBounds || (outgoingCountByNodeId.get(edge.target) ?? 0) > 0) return
      const currentSourceId = primaryTerminalSourceByTargetId.get(edge.target)
      const currentSource = currentSourceId ? nodeById.get(currentSourceId) : undefined
      const currentBounds = currentSource ? boundsForRow(currentSource) : undefined
      const currentDelta = currentBounds ? Math.abs(currentBounds.center.y - targetBounds.center.y) : Number.POSITIVE_INFINITY
      const nextDelta = Math.abs(sourceBounds.center.y - targetBounds.center.y)
      if (nextDelta >= currentDelta) return
      primaryTerminalSourceByTargetId.set(edge.target, edge.source)
    })
    const usedSourceDirectionsByNodeId = new Map<string, Set<AnchorDirection>>()
    const sourceBlockedDirectionsByNodeId = new Map<string, Set<AnchorDirection>>()
    const handlesByEdgeId = new Map<string, { sourceHandle?: string; targetHandle?: string; offset?: number }>()

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sourceBounds = source ? boundsForRow(source) : undefined
      const targetBounds = target ? boundsForRow(target) : undefined
      if (!source || !target || !sourceBounds || !targetBounds) {
        handlesByEdgeId.set(edge.id, { sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined })
        return
      }

      const sameLane = source.data.laneId === target.data.laneId
      const inferredHandles = inferEdgeHandles(sourceBounds, targetBounds, sameLane)
      const decisionSourceHandle = preferredSameLaneSourceHandleByEdgeId.get(edge.id)
      const preferredSourceDirection = directionFromHandle(edge.sourceHandle ?? decisionSourceHandle)
      const preferredTargetHandle = sameLane && (preferredSourceDirection === "left" || preferredSourceDirection === "right") ? `${preferredSourceDirection}-target` : inferredHandles.targetHandle
      const usedSourceDirections = usedSourceDirectionsByNodeId.get(edge.source) ?? new Set<AnchorDirection>()
      const sourceBlockedDirections = sourceBlockedDirectionsByNodeId.get(edge.source) ?? new Set<AnchorDirection>()
      const targetOccupiedDirections = new Set<AnchorDirection>(usedSourceDirectionsByNodeId.get(edge.target))
      reservedSourceDirectionsByNodeId.get(edge.target)?.forEach((direction) => targetOccupiedDirections.add(direction))
      const blockedBounds = graph.nodes
        .filter((node) => node.id !== source.id && node.id !== target.id)
        .map((node) => boundsForRow(node))
        .filter((bounds): bounds is RouteBounds => Boolean(bounds))
      const requestedSourceHandle = edge.sourceHandle ?? decisionSourceHandle ?? inferredHandles.sourceHandle
      const requestedTargetHandles = edge.targetHandle ? [edge.targetHandle] : [...new Set([preferredTargetHandle, inferredHandles.targetHandle])]
      const sameLaneDownwardGap = sameLane ? targetBounds.center.y - sourceBounds.center.y : 0
      const candidateHandleRequests: { requestedSourceHandle: string; requestedTargetHandle: string; offset?: number }[] = requestedTargetHandles.map((requestedTargetHandle) => ({ requestedSourceHandle, requestedTargetHandle }))
      if (!edge.sourceHandle && !edge.targetHandle && sameLaneDownwardGap > 220 && !sourceBlockedDirections.has("left") && !targetOccupiedDirections.has("left")) {
        candidateHandleRequests.push({ requestedSourceHandle: "left-source", requestedTargetHandle: "left-target" })
      }
      const requestedTargetDirection = directionFromHandle(requestedTargetHandles[0])
      const targetDemand = requestedTargetDirection ? targetDemandByNodeId.get(edge.target)?.get(requestedTargetDirection) ?? 0 : 0
      const targetIsTerminal = (outgoingCountByNodeId.get(edge.target) ?? 0) === 0
      const isPrimaryTerminalSource = targetIsTerminal && primaryTerminalSourceByTargetId.get(edge.target) === edge.source
      if (!edge.sourceHandle && !edge.targetHandle && !isPrimaryTerminalSource && !targetOccupiedDirections.has("top") && lateralSideTargetCorridorIsBlocked(sourceBounds, targetBounds, blockedBounds, sameLane)) {
        candidateHandleRequests.push({ requestedSourceHandle, requestedTargetHandle: "top-target" })
      }
      const bottomOffset = bottomCorridorOffset(sourceBounds, targetBounds, graph.nodes.map((node) => boundsForRow(node)).filter((bounds): bounds is RouteBounds => Boolean(bounds)), sameLane)
      const bottomDemand = endpointDemandByNodeId.get(edge.source)?.get("bottom") ?? 0
      const lowerTerminalOffset = lowerTerminalCorridorOffset(sourceBounds, targetBounds, blockedBounds, sameLane)
      if (!edge.sourceHandle && !edge.targetHandle && !sameLane && targetIsTerminal && targetBounds.center.y > sourceBounds.center.y + 80 && targetDemand > 1 && bottomDemand <= 1 && !targetOccupiedDirections.has("top") && !isPrimaryTerminalSource) {
        candidateHandleRequests.push({ requestedSourceHandle: "bottom-source", requestedTargetHandle: "top-target", offset: lowerTerminalOffset })
      }
      if (!edge.sourceHandle && !edge.targetHandle && targetDemand > 1 && bottomOffset !== undefined && bottomDemand <= 1) {
        candidateHandleRequests.push({ requestedSourceHandle: "bottom-source", requestedTargetHandle: "bottom-target", offset: bottomOffset })
      }
      const uniqueCandidateHandleRequests = [...new Map(candidateHandleRequests.map((handles) => [`${handles.requestedSourceHandle}:${handles.requestedTargetHandle}:${handles.offset ?? 0}`, handles])).values()]
      const scoredHandles = uniqueCandidateHandleRequests.map(({ requestedSourceHandle, requestedTargetHandle, offset }) => {
        const handles = resolveEdgeHandles({
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
        const route = buildLayoutRoute(source, target, edge, sourceBounds, targetBounds, blockedBounds, { ...handles, offset })
        const routeLength = route.points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - route.points[index].x) + Math.abs(point.y - route.points[index].y), 0)
        return {
          handles,
          offset,
          score: route.blockedBoundsCount * 100000 + route.blockedSegmentCount * 10000 + Math.max(0, route.points.length - 2) * 80 + routeLength,
        }
      }).sort((left, right) => left.score - right.score)
      const selectedScoredHandle = scoredHandles[0]
      const { sourceHandle, targetHandle } = selectedScoredHandle?.handles ?? resolveEdgeHandles({
        sourceBounds,
        targetBounds,
        sameLane,
        requestedSourceHandle,
        requestedTargetHandle: edge.targetHandle ?? preferredTargetHandle,
        usedSourceDirections,
        sourceOccupiedDirections: sourceBlockedDirections,
        targetOccupiedDirections,
        sourceVariant: source.data.variant,
      })
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

      handlesByEdgeId.set(edge.id, { sourceHandle, targetHandle, offset: selectedScoredHandle?.offset })
    })

    return handlesByEdgeId
  }

  const applyEdgeBlockAvoidanceOnce = () => {
    const resolvedHandlesByEdgeId = resolveEdgeHandlesForRows()
    const lockedDirectCrossLaneNodeIds = getLockedDirectCrossLaneNodeIds()
    const readabilityRowUpperBounds = getReadabilityRowUpperBounds()

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sourceRow = rowById.get(edge.source)
      const targetRow = rowById.get(edge.target)
      const sourceBounds = source ? boundsForRow(source) : undefined
      const targetBounds = target ? boundsForRow(target) : undefined
      if (!source || !target || sourceRow === undefined || targetRow === undefined || !sourceBounds || !targetBounds) return

      const blockedNodes = graph.nodes
        .filter((node) => node.id !== source.id && node.id !== target.id)
        .map((node) => ({ node, bounds: boundsForRow(node) }))
        .filter((entry): entry is { node: DiagramNode; bounds: RouteBounds } => Boolean(entry.bounds))
      const route = buildLayoutRoute(
        source,
        target,
        edge,
        sourceBounds,
        targetBounds,
        blockedNodes.map((entry) => entry.bounds),
        resolvedHandlesByEdgeId.get(edge.id),
      )
      if (route.isClear) return

      const maxEdgeRow = Math.max(sourceRow, targetRow)
      blockedNodes.forEach(({ node, bounds }) => {
        if (!pathIntersectsBounds(route.points, bounds)) return
        if (lockedDirectCrossLaneNodeIds.has(node.id)) return

        const nodeRow = rowById.get(node.id) ?? 0
        const nextRow = Math.max(nodeRow + 1, maxEdgeRow + 1)
        const maxReadableRow = readabilityRowUpperBounds.get(node.id)
        if (maxReadableRow !== undefined && nextRow > maxReadableRow) return
        if (nextRow === nodeRow) return
        rowById.set(node.id, nextRow)
      })
    })
  }

  const compactRows = () => {
    const orderedRows = [...new Set([...rowById.values()].sort((left, right) => left - right))]
    const compactRowByValue = new Map(orderedRows.map((row, index) => [row, index]))
    rowById.forEach((row, nodeId) => {
      rowById.set(nodeId, compactRowByValue.get(row) ?? row)
    })
  }

  const restoreRouteClearance = (expandedRowsBeforeCompaction: Map<string, number>) => {
    let changed = false
    const resolvedHandlesByEdgeId = resolveEdgeHandlesForRows()

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      const sourceBounds = source ? boundsForRow(source) : undefined
      const targetBounds = target ? boundsForRow(target) : undefined
      if (!source || !target || !sourceBounds || !targetBounds) return

      const blockedNodes = graph.nodes
        .filter((node) => node.id !== source.id && node.id !== target.id)
        .map((node) => ({ node, bounds: boundsForRow(node) }))
        .filter((entry): entry is { node: DiagramNode; bounds: RouteBounds } => Boolean(entry.bounds))
      const route = buildLayoutRoute(
        source,
        target,
        edge,
        sourceBounds,
        targetBounds,
        blockedNodes.map((entry) => entry.bounds),
        resolvedHandlesByEdgeId.get(edge.id),
      )
      if (route.isClear) return

      blockedNodes.forEach(({ node, bounds }) => {
        if (!pathIntersectsBounds(route.points, bounds)) return
        const previousRow = expandedRowsBeforeCompaction.get(node.id)
        const currentRow = rowById.get(node.id)
        if (previousRow === undefined || currentRow === undefined || previousRow <= currentRow) return
        rowById.set(node.id, previousRow)
        changed = true
      })
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
    const orderChanged = enforceReadableLaneOrder()
    if (!edgeChanged && !collisionChanged && !orderChanged) break
  }

  if (shouldAvoidBlocks) applyEdgeBlockAvoidanceOnce()
  applyLaneCollisions()
  const expandedRowsBeforeCompaction = new Map(rowById)
  compactRows()
  if (shouldAvoidBlocks) {
    const maxRestoreIterations = Math.max(1, graph.nodes.length)
    for (let index = 0; index < maxRestoreIterations; index += 1) {
      const clearanceChanged = restoreRouteClearance(expandedRowsBeforeCompaction)
      const edgeChanged = clearanceChanged ? applyEdgeConstraints() : false
      const collisionChanged = clearanceChanged ? applyLaneCollisions() : false
      const orderChanged = clearanceChanged ? enforceReadableLaneOrder() : false
      if (!clearanceChanged && !edgeChanged && !collisionChanged && !orderChanged) break
    }
  }

  const maxReadableOrderIterations = Math.max(1, graph.nodes.length)
  for (let index = 0; index < maxReadableOrderIterations; index += 1) {
    const orderChanged = enforceReadableLaneOrder()
    const collisionChanged = orderChanged ? applyLaneCollisions() : false
    if (!orderChanged && !collisionChanged) break
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
