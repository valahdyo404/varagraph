export type LaneId = string

export type DiagramNodeVariant = "startEnd" | "process" | "decision" | "subProcess" | "inputOutput" | "annotation"

export type DiagramNodeStyle = {
  backgroundColor?: string
  borderColor?: string
  textColor?: string
}

export type Swimlane = {
  id: LaneId
  title: string
  color: string
  x: number
  width: number
}

export type DiagramNodeData = {
  label: string
  laneId: LaneId
  variant: DiagramNodeVariant
  style?: DiagramNodeStyle
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
}

export type DiagramEdge = {
  id: string
  source: string
  target: string
  type: "smoothstep"
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
