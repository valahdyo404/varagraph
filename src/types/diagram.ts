import type { GraphModel } from './graph'

export type DiagramMeta = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type DiagramDraft = {
  graph: GraphModel
  mermaidSource: string
}

export type DiagramIndex = {
  diagrams: DiagramMeta[]
  activeDiagramId: string | null
  version: 2
}