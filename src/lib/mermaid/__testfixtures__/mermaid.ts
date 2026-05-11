export const simpleMermaid = `flowchart LR
  subgraph lane1[Main]
    A([Start])
    B[Process]
  end
  A --> B
`

export const crossLaneMermaid = `flowchart LR
  subgraph lane1[Frontend]
    A[Request]
  end
  subgraph lane2[Backend]
    B[Handle]
  end
  A --> B
`

export const edgeTypesMermaid = `flowchart LR
  subgraph lane1[Main]
    A[Start]
    B[Mid]
    C[End]
    D[Side]
  end
  A --> B
  B -- labeled --> C
  C --- D
  A <--> D
`