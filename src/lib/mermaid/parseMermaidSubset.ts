import type { DiagramEdge, DiagramEdgeArrow, DiagramNode, DiagramNodeVariant, ParseResult, Swimlane } from "../../types/graph"

const laneColors = ["#F0E8FF", "#EAF2FF", "#E8F8F4", "#FFF0E6", "#F8E8F6"]

const getNodeVariant = (shape: string): DiagramNodeVariant => {
  if (shape.startsWith("([") && shape.endsWith("])")) return "startEnd"
  if (shape.startsWith("{") && shape.endsWith("}")) return "decision"
  return "process"
}

const getNodeLabel = (shape: string): string => {
  if (shape.startsWith("([") && shape.endsWith("])")) return shape.slice(2, -2).trim()
  if (shape.startsWith("[") && shape.endsWith("]")) return shape.slice(1, -1).trim()
  if (shape.startsWith("{") && shape.endsWith("}")) return shape.slice(1, -1).trim()
  return shape.trim()
}

const unsupported = (line: number, text: string): ParseResult => ({
  ok: false,
  error: {
    message: `Unsupported Mermaid syntax: ${text}`,
    line,
  },
})

const addEdge = (
  edges: DiagramEdge[],
  edgeRefs: Set<string>,
  source: string,
  target: string,
  label: string,
  arrowDirection: DiagramEdgeArrow,
) => {
  edgeRefs.add(source)
  edgeRefs.add(target)
  edges.push({
    id: `${source}-${target}-${edges.length}`,
    source,
    target,
    type: "straight",
    label: label.trim() || undefined,
    data: { label: label.trim() || undefined, arrowDirection },
  })
}

export const parseMermaidSubset = (source: string): ParseResult => {
  if (!source.trim()) {
    return {
      ok: false,
      error: { message: "Mermaid input is empty" },
    }
  }

  const rawLines = source.replace(/\r\n/g, "\n").split("\n")
  const lines = rawLines.map((text, index) => ({ text: text.trim(), line: index + 1 })).filter((line) => line.text && !line.text.startsWith("%%"))
  const first = lines[0]

  if (!first || first.text !== "flowchart LR") {
    return {
      ok: false,
      error: {
        message: "Only flowchart LR is supported",
        line: first?.line,
      },
    }
  }

  const lanes: Swimlane[] = []
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const nodeIds = new Set<string>()
  const edgeRefs = new Set<string>()
  let currentLaneId = ""

  for (const { text, line } of lines.slice(1)) {
    const subgraph = text.match(/^subgraph\s+([A-Za-z][\w-]*)\[(.+)]$/)
    if (subgraph) {
      if (currentLaneId) return unsupported(line, text)
      currentLaneId = subgraph[1]
      lanes.push({
        id: currentLaneId,
        title: subgraph[2].trim(),
        color: laneColors[lanes.length % laneColors.length],
        x: 0,
        width: 240,
      })
      continue
    }

    if (text === "end") {
      if (!currentLaneId) return unsupported(line, text)
      currentLaneId = ""
      continue
    }

    const bothLabeledEdge = text.match(/^([A-Za-z][\w-]*)\s+<--\s+(.+?)\s+-->\s+([A-Za-z][\w-]*)$/)
    if (bothLabeledEdge) {
      const [, source, label, target] = bothLabeledEdge
      addEdge(edges, edgeRefs, source, target, label, "both")
      continue
    }

    const bothEdge = text.match(/^([A-Za-z][\w-]*)\s+<-->\s+([A-Za-z][\w-]*)$/)
    if (bothEdge) {
      const [, source, target] = bothEdge
      addEdge(edges, edgeRefs, source, target, "", "both")
      continue
    }

    const noneLabeledEdge = text.match(/^([A-Za-z][\w-]*)\s+--\s+(.+?)\s+---\s+([A-Za-z][\w-]*)$/)
    if (noneLabeledEdge) {
      const [, source, label, target] = noneLabeledEdge
      addEdge(edges, edgeRefs, source, target, label, "none")
      continue
    }

    const noneEdge = text.match(/^([A-Za-z][\w-]*)\s+---\s+([A-Za-z][\w-]*)$/)
    if (noneEdge) {
      const [, source, target] = noneEdge
      addEdge(edges, edgeRefs, source, target, "", "none")
      continue
    }

    const labeledEdge = text.match(/^([A-Za-z][\w-]*)\s+--\s+(.+?)\s+-->\s+([A-Za-z][\w-]*)$/)
    if (labeledEdge) {
      const [, source, label, target] = labeledEdge
      addEdge(edges, edgeRefs, source, target, label, "forward")
      continue
    }

    const edge = text.match(/^([A-Za-z][\w-]*)\s+-->\s+([A-Za-z][\w-]*)$/)
    if (edge) {
      const [, source, target] = edge
      addEdge(edges, edgeRefs, source, target, "", "forward")
      continue
    }

    const node = text.match(/^([A-Za-z][\w-]*)(\(\[[^\]]+\]\)|\[[^\]]+\]|\{[^}]+\})$/)
    if (node) {
      if (!currentLaneId) return unsupported(line, text)
      const [, id, shape] = node
      if (nodeIds.has(id)) {
        return {
          ok: false,
          error: {
            message: `Duplicate node id: ${id}`,
            line,
          },
        }
      }
      nodeIds.add(id)
      nodes.push({
        id,
        type: "diagramNode",
        position: { x: 0, y: 0 },
        data: {
          label: getNodeLabel(shape),
          laneId: currentLaneId,
          variant: getNodeVariant(shape),
        },
      })
      continue
    }

    return unsupported(line, text)
  }

  if (currentLaneId) {
    return {
      ok: false,
      error: {
        message: `Missing end for subgraph ${currentLaneId}`,
      },
    }
  }

  const missingNodeIds = Array.from(edgeRefs).filter((id) => !nodeIds.has(id))
  if (missingNodeIds.length > 0) {
    return {
      ok: false,
      error: {
        message: `Missing edge node references: ${missingNodeIds.join(", ")}`,
        missingNodeIds,
      },
    }
  }

  return {
    ok: true,
    graph: { lanes, nodes, edges },
  }
}
