import type { GraphModel } from "../../../types/graph"

export const emptyGraph: GraphModel = { lanes: [], nodes: [], edges: [] }

export const singleNodeGraph: GraphModel = {
  lanes: [{ id: "lane-1", title: "Main", color: "#F0E8FF", x: 0, width: 220 }],
  nodes: [{
    id: "A", type: "diagramNode", position: { x: 0, y: 0 },
    data: { label: "Start", laneId: "lane-1", variant: "startEnd" }
  }],
  edges: []
}

export const simpleFlow: GraphModel = {
  lanes: [{ id: "lane-1", title: "Main", color: "#F0E8FF", x: 0, width: 220 }],
  nodes: [
    { id: "A", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Start", laneId: "lane-1", variant: "startEnd" } },
    { id: "B", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Process", laneId: "lane-1", variant: "process" } },
    { id: "C", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "End", laneId: "lane-1", variant: "startEnd" } },
  ],
  edges: [
    { id: "A-B", source: "A", target: "B", type: "straight" },
    { id: "B-C", source: "B", target: "C", type: "straight" },
  ]
}

export const crossLaneFlow: GraphModel = {
  lanes: [
    { id: "lane-1", title: "Frontend", color: "#F0E8FF", x: 0, width: 220 },
    { id: "lane-2", title: "Backend", color: "#EAF2FF", x: 0, width: 220 },
  ],
  nodes: [
    { id: "FE", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Request", laneId: "lane-1", variant: "process" } },
    { id: "BE", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Handle", laneId: "lane-2", variant: "process" } },
  ],
  edges: [
    { id: "FE-BE", source: "FE", target: "BE", type: "straight" },
  ]
}

export const decisionGraph: GraphModel = {
  lanes: [{ id: "lane-1", title: "Main", color: "#F0E8FF", x: 0, width: 220 }],
  nodes: [
    { id: "D", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Check", laneId: "lane-1", variant: "decision" } },
    { id: "Y", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Yes", laneId: "lane-1", variant: "process" } },
    { id: "N", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "No", laneId: "lane-1", variant: "process" } },
  ],
  edges: [
    { id: "D-Y", source: "D", target: "Y", type: "straight" },
    { id: "D-N", source: "D", target: "N", type: "straight" },
  ]
}

export const complexGraph: GraphModel = {
  lanes: [
    { id: "lane-1", title: "Client", color: "#F0E8FF", x: 0, width: 220 },
    { id: "lane-2", title: "API", color: "#EAF2FF", x: 0, width: 220 },
    { id: "lane-3", title: "DB", color: "#E8F8F4", x: 0, width: 220 },
  ],
  nodes: [
    { id: "A", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Submit", laneId: "lane-1", variant: "startEnd" } },
    { id: "B", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Validate", laneId: "lane-2", variant: "decision" } },
    { id: "C", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Store", laneId: "lane-3", variant: "process" } },
    { id: "D", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Error", laneId: "lane-1", variant: "process" } },
    { id: "E", type: "diagramNode", position: { x: 0, y: 0 }, data: { label: "Confirm", laneId: "lane-1", variant: "startEnd" } },
  ],
  edges: [
    { id: "A-B", source: "A", target: "B", type: "straight" },
    { id: "B-C", source: "B", target: "C", type: "straight" },
    { id: "B-D", source: "B", target: "D", type: "straight" },
    { id: "C-E", source: "C", target: "E", type: "straight" },
  ]
}