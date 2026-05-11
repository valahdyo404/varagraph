import { describe, it, expect } from 'vitest'
import { parseMermaidSubset } from './parseMermaidSubset'

describe('parseMermaidSubset', () => {
  it('returns error for empty string', () => {
    const result = parseMermaidSubset('')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toBe('Mermaid input is empty')
  })

  it('returns error for whitespace-only string', () => {
    const result = parseMermaidSubset('   \n\n  ')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toBe('Mermaid input is empty')
  })

  it('returns error for non-flowchart-LR header', () => {
    const result = parseMermaidSubset('flowchart TD\n  A[Start]\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toBe('Only flowchart LR is supported')
  })

  it('parses single lane with one node', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A([Start])
  end
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.lanes).toHaveLength(1)
    expect(result.graph.lanes[0].id).toBe('lane1')
    expect(result.graph.nodes).toHaveLength(1)
    expect(result.graph.nodes[0].id).toBe('A')
    expect(result.graph.nodes[0].data.label).toBe('Start')
    expect(result.graph.nodes[0].data.variant).toBe('startEnd')
    expect(result.graph.nodes[0].data.laneId).toBe('lane1')
  })

  it('parses multiple lanes with nodes', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Frontend]
    A[Request]
  end
  subgraph lane2[Backend]
    B[Handle]
  end
  A --> B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.lanes).toHaveLength(2)
    expect(result.graph.nodes).toHaveLength(2)
    expect(result.graph.edges).toHaveLength(1)
    expect(result.graph.edges[0].source).toBe('A')
    expect(result.graph.edges[0].target).toBe('B')
    expect(result.graph.edges[0].data?.arrowDirection).toBe('forward')
  })

  it('parses forward arrow -->', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  A --> B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0].data?.arrowDirection).toBe('forward')
  })

  it('parses labeled forward arrow', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  A -- label --> B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0].label).toBe('label')
    expect(result.graph.edges[0].data?.arrowDirection).toBe('forward')
  })

  it('parses both arrow <-->', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  A <--> B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0].data?.arrowDirection).toBe('both')
  })

  it('parses both labeled arrow <-- label -->', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  A <-- label --> B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0].label).toBe('label')
    expect(result.graph.edges[0].data?.arrowDirection).toBe('both')
  })

  it('parses none arrow ---', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  A --- B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0].data?.arrowDirection).toBe('none')
  })

  it('parses labeled none arrow -- label ---', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  A -- label --- B
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.edges[0].label).toBe('label')
    expect(result.graph.edges[0].data?.arrowDirection).toBe('none')
  })

  it('returns error for duplicate node ID', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    A[End]
  end
`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toBe('Duplicate node id: A')
  })

  it('returns error for missing end for subgraph', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toBe('Missing end for subgraph lane1')
  })

  it('returns error for edge referencing non-existent node', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
  end
  A --> B
`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('Missing edge node references')
    expect(result.error.missingNodeIds).toContain('B')
  })

  it('ignores comment lines starting with %%', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[End]
  end
  %% this is a comment
  A --> B
`)
    expect(result.ok).toBe(true)
  })

  it('handles CRLF line endings', () => {
    const result = parseMermaidSubset('flowchart LR\r\n  subgraph lane1[Main]\r\n    A[Start]\r\n  end\r\n')
    expect(result.ok).toBe(true)
  })

  it('handles trailing whitespace and blank lines', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
  end

`)
    expect(result.ok).toBe(true)
  })

  it('parses decision node variant', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A{Check}
  end
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.nodes[0].data.variant).toBe('decision')
  })

  it('parses process node variant', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Process]
  end
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.nodes[0].data.variant).toBe('process')
  })

  it('assigns lane colors from palette', () => {
    const result = parseMermaidSubset(`flowchart LR
  subgraph lane1[Main]
    A[Start]
  end
  subgraph lane2[Other]
    B[End]
  end
`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.graph.lanes[0].color).toBe('#F0E8FF')
    expect(result.graph.lanes[1].color).toBe('#EAF2FF')
  })
})