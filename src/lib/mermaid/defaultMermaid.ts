export const defaultMermaid = `flowchart LR
  subgraph A[Workflow Initiation]
    A1([Begin the Operational Workflow])
  end

  subgraph B[Task Preparation]
    B1[Initialize Assigned Task]
  end

  subgraph C[Execution & Processing]
    C1[Execute Initial Operation]
    C2{Condition Satisfied?}
    C3[Process Input Data]
    C4[Validate Output]
    C5[Finalize Pending Tasks]
    C6([Complete Required Tasks])
  end

  subgraph D[Exception Handling]
    D1[Handle Exceptions]
    D2{Retry This Step?}
    D3[Retry Operation]
  end

  subgraph E[Finalization]
    E1[Finalize Output]
    E2([Terminate Process and Exit Flow])
  end

  A1 --> B1
  B1 --> C1
  C1 --> C2
  C2 -- Yes --> C3
  C2 -- No --> D1
  C3 --> C4
  C4 --> D2
  D2 -- Yes --> D3
  D2 -- No --> D1
  D3 --> C5
  D1 --> E1
  E1 --> E2
  C4 --> C5
  C5 --> C6
`
