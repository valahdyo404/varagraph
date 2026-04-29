import type { DiagramEdgeArrow, DiagramEdgeType, GraphModel } from "../../types/graph"

export type ExportedGraph = {
  version: "0.2"
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
    arrowDirection: DiagramEdgeArrow
    type: DiagramEdgeType
    sourceHandle?: string
    targetHandle?: string
  }>
  styles: Record<string, string>
  settings: Record<string, string | boolean | number>
}

export const exportGraph = (graph: GraphModel): ExportedGraph => ({
  version: "0.2",
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
    label: edge.label ?? edge.data?.label ?? "",
    arrowDirection: edge.data?.arrowDirection ?? "forward",
    type: edge.type,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  })),
  styles: {},
  settings: {},
})

export const exportGraphJson = (graph: GraphModel): string => JSON.stringify(exportGraph(graph), null, 2)

const sanitizeMermaidId = (id: string): string => {
  const normalized = id.replace(/[^A-Za-z0-9_]/g, "_")
  return /^[A-Za-z]/.test(normalized) ? normalized : `N_${normalized}`
}

const escapeLabel = (label: string): string => label.replace(/"/g, "'").replace(/\]/g, ")").replace(/\}/g, ")").trim()

const nodeShape = (variant: string, label: string): string => {
  const safeLabel = escapeLabel(label || "Untitled")
  if (variant === "startEnd") return `([${safeLabel}])`
  if (variant === "decision") return `{${safeLabel}}`
  return `[${safeLabel}]`
}

const edgeLine = (source: string, target: string, label: string, arrowDirection: DiagramEdgeArrow): string => {
  const trimmedLabel = escapeLabel(label)
  const edgeLabel = trimmedLabel ? ` ${trimmedLabel} ` : ""

  if (arrowDirection === "reverse") {
    return trimmedLabel ? `${target} --${edgeLabel}--> ${source}` : `${target} --> ${source}`
  }
  if (arrowDirection === "both") {
    return trimmedLabel ? `${source} <--${edgeLabel}--> ${target}` : `${source} <--> ${target}`
  }
  if (arrowDirection === "none") {
    return trimmedLabel ? `${source} --${edgeLabel}--- ${target}` : `${source} --- ${target}`
  }
  return trimmedLabel ? `${source} --${edgeLabel}--> ${target}` : `${source} --> ${target}`
}

export const exportGraphMermaid = (graph: GraphModel): string => {
  const idMap = new Map(graph.nodes.map((node) => [node.id, sanitizeMermaidId(node.id)]))
  const lines = ["flowchart LR"]

  graph.lanes.forEach((lane) => {
    const laneNodeIds = graph.nodes.filter((node) => node.data.laneId === lane.id)
    if (laneNodeIds.length === 0) return
    lines.push(`  subgraph ${sanitizeMermaidId(lane.id)}[${escapeLabel(lane.title)}]`)
    laneNodeIds.forEach((node) => {
      lines.push(`    ${idMap.get(node.id)}${nodeShape(node.data.variant, node.data.label)}`)
    })
    lines.push("  end")
    lines.push("")
  })

  graph.edges.forEach((edge) => {
    const source = idMap.get(edge.source)
    const target = idMap.get(edge.target)
    if (!source || !target) return
    lines.push(`  ${edgeLine(source, target, edge.label ?? edge.data?.label ?? "", edge.data?.arrowDirection ?? "forward")}`)
  })

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}
