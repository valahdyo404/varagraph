import { domToPng } from 'modern-screenshot'
import type { GraphModel } from '../../types/graph'
import { estimateNodeHeight, nodeWidth } from './autoLayout'

export type DiagramBounds = {
  width: number
  height: number
  canvasHeight: number
  viewport: { x: number; y: number; zoom: number }
}

const laneHeaderHeight = 78
const minimumExportWidth = 420
const minimumExportHeight = 320
const exportBottomPadding = 36

export function getDiagramBounds(graph: GraphModel): DiagramBounds {
  if (graph.lanes.length === 0 && graph.nodes.length === 0) {
    return { width: 900, height: 560, canvasHeight: 560, viewport: { x: 0, y: 0, zoom: 1 } }
  }

  const laneMinX = graph.lanes.length > 0 ? Math.min(...graph.lanes.map((lane) => lane.x)) : 0
  const laneMaxX = graph.lanes.length > 0 ? Math.max(...graph.lanes.map((lane) => lane.x + lane.width)) : 0
  const nodeMinX = graph.nodes.length > 0 ? Math.min(...graph.nodes.map((node) => node.position.x)) : laneMinX
  const nodeMaxX = graph.nodes.length > 0 ? Math.max(...graph.nodes.map((node) => node.position.x + nodeWidth)) : laneMaxX
  const minX = Math.min(laneMinX, nodeMinX)
  const maxX = Math.max(laneMaxX, nodeMaxX)
  const maxY = Math.max(laneHeaderHeight, ...graph.nodes.map((node) => node.position.y + estimateNodeHeight(node)))
  const width = Math.ceil(Math.max(minimumExportWidth, maxX - minX))
  const height = Math.ceil(Math.max(minimumExportHeight, maxY + exportBottomPadding))

  return {
    width,
    height,
    canvasHeight: height,
    viewport: { x: -minX, y: 0, zoom: 1 },
  }
}

const safeFilename = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'diagram'

const waitForPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

const timeoutAfter = (milliseconds: number) =>
  new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error(`PNG export timed out after ${milliseconds}ms`)), milliseconds)
  })

const renderElementToPng = (element: HTMLElement, scale: number, width: number, height: number) =>
  domToPng(element, {
    backgroundColor: '#FFFFFF',
    filter: (node) => !(node instanceof HTMLElement) || !node.classList.contains('react-flow__panel'),
    height,
    scale,
    width,
  })

export async function downloadDiagramElementPng(element: HTMLElement, diagramName: string, scale = 2) {
  if (document.fonts?.ready) await document.fonts.ready
  await waitForPaint()

  const width = Math.ceil(element.getBoundingClientRect().width)
  const height = Math.ceil(element.getBoundingClientRect().height)
  const dataUrl = await Promise.race([renderElementToPng(element, scale, width, height), timeoutAfter(12000)])

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `varagraph-${safeFilename(diagramName)}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
}
