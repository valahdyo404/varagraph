import type { DiagramNode, GraphModel, Swimlane } from "../../types/graph"

export const laneColors = ["#F0E8FF", "#EAF2FF", "#E8F8F4", "#FFF0E6", "#F8E8F6"]
export const laneWidth = 220
export const laneGap = 0
export const laneStartX = 0
export const nodeWidth = 152
export const nodeOffsetX = 34
export const nodeStartY = 136
export const nodeGapY = 150
const nodeTextLineHeight = 16
const nodeVerticalPadding = 26
const nodeMinHeight = 62
const decisionNodeHeight = 124
const nodeTextLineCapacity = 13

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

export const autoLayoutGraph = (graph: GraphModel): GraphModel => {
  const safeGraph = ensureLaneInvariant(graph)
  const lanes = normalizeLanes(safeGraph.lanes)
  const laneCounts = new Map<string, number>()
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]))
  const rowCenterOffset = (safeGraph.nodes[0] ? estimateNodeHeight(safeGraph.nodes[0]) : nodeMinHeight) / 2

  const nodes: DiagramNode[] = safeGraph.nodes.map((node) => {
    const laneId = getSafeLaneId(lanes, node.data.laneId)
    const lane = laneById.get(laneId)
    const count = laneCounts.get(laneId) ?? 0
    laneCounts.set(laneId, count + 1)

    return {
      ...node,
      position: {
        x: lane ? nodeXForLane(lane) : laneStartX,
        y: nodeStartY + count * nodeGapY + rowCenterOffset - estimateNodeHeight(node) / 2,
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
