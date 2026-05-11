export type LaneId = string

export type DiagramNodeVariant = "startEnd" | "process" | "decision" | "subProcess" | "inputOutput" | "annotation"

export type DiagramNodeStyle = {
  backgroundColor?: string
  borderColor?: string
  textColor?: string
}

export type DiagramEdgeArrow = "forward" | "reverse" | "both" | "none"
export type DiagramEdgeType = "straight" | "default" | "step" | "smoothstep"

export type LaneIcon = "rocket" | "clipboard" | "settings" | "alert" | "flag" | "none"

export type Swimlane = {
  id: LaneId
  title: string
  color: string
  icon?: LaneIcon
  x: number
  width: number
}

export type DiagramNodeData = {
  label: string
  laneId: LaneId
  variant: DiagramNodeVariant
  style?: DiagramNodeStyle
  validationError?: string
}

export type DiagramNode = {
  id: string
  type: "diagramNode"
  position: {
    x: number
    y: number
  }
  data: DiagramNodeData
}

export type DiagramEdgeData = {
  label?: string
  arrowDirection?: DiagramEdgeArrow
}

export type DiagramEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: DiagramEdgeType
  animated?: boolean
  label?: string
  data?: DiagramEdgeData
}

export type GraphModel = {
  lanes: Swimlane[]
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export type ParseSuccess = {
  ok: true
  graph: GraphModel
}

export type ParseFailure = {
  ok: false
  error: {
    message: string
    line?: number
    missingNodeIds?: string[]
  }
}

export type ParseResult = ParseSuccess | ParseFailure
