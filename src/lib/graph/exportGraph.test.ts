import { describe, it, expect } from 'vitest'
import { exportGraph, exportGraphJson, exportGraphMermaid } from './exportGraph'
import { simpleFlow, crossLaneFlow, decisionGraph, complexGraph } from './__testfixtures__/graphs'

describe('exportGraph', () => {
  it('produces ExportedGraph with version 0.2', () => {
    const result = exportGraph(simpleFlow)
    expect(result.version).toBe('0.2')
  })

  it('maps node fields correctly', () => {
    const result = exportGraph(simpleFlow)
    const node = result.nodes[0]
    expect(node.id).toBe('A')
    expect(node.label).toBe('Start')
    expect(node.variant).toBe('startEnd')
    expect(node.laneId).toBe('lane-1')
    expect(node.position).toEqual({ x: 0, y: 0 })
    expect(node.style).toEqual({})
  })

  it('maps edge fields correctly', () => {
    const result = exportGraph(simpleFlow)
    const edge = result.edges[0]
    expect(edge.id).toBe('A-B')
    expect(edge.source).toBe('A')
    expect(edge.target).toBe('B')
    expect(edge.type).toBe('straight')
    expect(edge.sourceHandle).toBeUndefined()
    expect(edge.targetHandle).toBeUndefined()
  })

  it('falls back edge label from data.label', () => {
    const graphWithEdgeLabel = {
      ...simpleFlow,
      edges: [{ id: 'A-B', source: 'A', target: 'B', type: 'straight' as const, data: { label: 'edge label' } }],
    }
    const result = exportGraph(graphWithEdgeLabel)
    expect(result.edges[0].label).toBe('edge label')
  })

  it('defaults arrow direction to forward', () => {
    const result = exportGraph(simpleFlow)
    expect(result.edges[0].arrowDirection).toBe('forward')
  })

  it('defaults empty style to empty object', () => {
    const result = exportGraph(simpleFlow)
    expect(result.styles).toEqual({})
    expect(result.settings).toEqual({})
  })

  it('maps node with custom style', () => {
    const graphWithStyle = {
      ...simpleFlow,
      nodes: [{ id: 'A', type: 'diagramNode' as const, position: { x: 0, y: 0 }, data: { label: 'Start', laneId: 'lane-1', variant: 'startEnd' as const, style: { backgroundColor: '#fff' } } }],
    }
    const result = exportGraph(graphWithStyle)
    expect(result.nodes[0].style).toEqual({ backgroundColor: '#fff' })
  })

  it('maps edge with source and target handles', () => {
    const graphWithHandles = {
      ...simpleFlow,
      edges: [{ id: 'A-B', source: 'A', target: 'B', type: 'straight' as const, sourceHandle: 'right-source', targetHandle: 'left-target' }],
    }
    const result = exportGraph(graphWithHandles)
    expect(result.edges[0].sourceHandle).toBe('right-source')
    expect(result.edges[0].targetHandle).toBe('left-target')
  })

  it('preserves all node IDs', () => {
    const result = exportGraph(complexGraph)
    const ids = result.nodes.map(n => n.id)
    expect(ids).toContain('A')
    expect(ids).toContain('B')
    expect(ids).toContain('C')
    expect(ids).toContain('D')
    expect(ids).toContain('E')
  })

  it('preserves all edge IDs', () => {
    const result = exportGraph(complexGraph)
    const ids = result.edges.map(e => e.id)
    expect(ids).toContain('A-B')
    expect(ids).toContain('B-C')
    expect(ids).toContain('B-D')
    expect(ids).toContain('C-E')
  })

  it('maps decision node variant', () => {
    const result = exportGraph(decisionGraph)
    const decisionNode = result.nodes.find(n => n.variant === 'decision')
    expect(decisionNode).toBeDefined()
    expect(decisionNode?.variant).toBe('decision')
  })
})

describe('exportGraphJson', () => {
  it('returns valid JSON string with 2-space indentation', () => {
    const json = exportGraphJson(simpleFlow)
    expect(() => JSON.parse(json)).not.toThrow()
    expect(json).toContain('  "version": "0.2"')
  })

  it('can be parsed back to ExportedGraph', () => {
    const json = exportGraphJson(simpleFlow)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('0.2')
    expect(parsed.nodes).toHaveLength(3)
    expect(parsed.edges).toHaveLength(2)
  })
})

describe('exportGraphMermaid', () => {
  it('starts with flowchart LR', () => {
    const output = exportGraphMermaid(simpleFlow)
    expect(output).toMatch(/^flowchart LR/)
  })

  it('emits subgraph blocks for each lane with nodes', () => {
    const output = exportGraphMermaid(crossLaneFlow)
    expect(output).toContain('subgraph')
    expect(output).toContain('Frontend')
    expect(output).toContain('Backend')
  })

  it('skips empty lanes', () => {
    const graphWithEmptyLane = {
      ...crossLaneFlow,
      lanes: [...crossLaneFlow.lanes, { id: 'lane-3', title: 'Empty', color: '#fff', x: 0, width: 220 }],
    }
    const output = exportGraphMermaid(graphWithEmptyLane)
    expect(output).not.toContain('Empty')
  })

  it('emits edge lines with correct arrow syntax', () => {
    const output = exportGraphMermaid(simpleFlow)
    expect(output).toContain('-->')
  })

  it('sanitizes node IDs with special characters', () => {
    const graphWithSpecialId = {
      ...simpleFlow,
      nodes: [{ id: 'node-1', type: 'diagramNode' as const, position: { x: 0, y: 0 }, data: { label: 'Start', laneId: 'lane-1', variant: 'startEnd' as const } }],
    }
    const output = exportGraphMermaid(graphWithSpecialId)
    expect(output).toContain('node_1')
  })

  it('sanitizes node IDs starting with digit', () => {
    const graphWithDigitId = {
      ...simpleFlow,
      nodes: [{ id: '1node', type: 'diagramNode' as const, position: { x: 0, y: 0 }, data: { label: 'Start', laneId: 'lane-1', variant: 'startEnd' as const } }],
    }
    const output = exportGraphMermaid(graphWithDigitId)
    expect(output).toContain('N_1node')
  })

  it('escapes quotes in labels', () => {
    const graphWithQuote = {
      ...simpleFlow,
      nodes: [{ id: 'A', type: 'diagramNode' as const, position: { x: 0, y: 0 }, data: { label: 'Start "Here"', laneId: 'lane-1', variant: 'startEnd' as const } }],
    }
    const output = exportGraphMermaid(graphWithQuote)
    expect(output).toContain("Start 'Here'")
  })

  it('escapes brackets in labels', () => {
    const graphWithBracket = {
      ...simpleFlow,
      nodes: [{ id: 'A', type: 'diagramNode' as const, position: { x: 0, y: 0 }, data: { label: 'Start [Here]', laneId: 'lane-1', variant: 'startEnd' as const } }],
    }
    const output = exportGraphMermaid(graphWithBracket)
    expect(output).toContain('Start [Here)')
  })

  it('trims trailing newlines', () => {
    const output = exportGraphMermaid(simpleFlow)
    expect(output.endsWith('\n')).toBe(true)
    expect(output.trimEnd().endsWith('\n')).toBe(false)
  })
})