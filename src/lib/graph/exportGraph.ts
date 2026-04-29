import type { GraphModel } from "../../types/graph"

export type ExportedGraph = {
  version: "0.1"
  lanes: GraphModel["lanes"]
  nodes: Array<{
    id: string
    label: string
    variant: string
    laneId: string
    position: { x: number; y: number }
    style: Record<string, string>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label: string
  }>
  styles: Record<string, string>
  settings: Record<string, string | boolean | number>
}

export const exportGraph = (graph: GraphModel): ExportedGraph => ({
  version: "0.1",
  lanes: graph.lanes,
  nodes: graph.nodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    variant: node.data.variant,
    laneId: node.data.laneId,
    position: node.position,
    style: node.data.style ?? {},
  })),
  edges: graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? "",
  })),
  styles: {},
  settings: {},
})

export const exportGraphJson = (graph: GraphModel): string => JSON.stringify(exportGraph(graph), null, 2)
