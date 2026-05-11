flowchart LR
  subgraph A[Adhara]
    A1([Open Host Page])
    A2[Check Existing Session]
    A3{Session Found?}
    A4[Request SSO Ticket]
    A5[Store Ticket]
    A6[Click Consume MFE]
    A7([Show Result])
  end

  subgraph B[Parama Backend]
    B1[Validate Cookie]
    B2[Return Session Data]
    B3[Validate SSO Request]
    B4[Create Ticket]
    B5[Consume Ticket]
    B6{Ticket Valid?}
    B7[Create Cookie Session]
    B8[Return Auth Payload]
    B9[Return Unauthorized]
  end

  subgraph C[Parama MFE]
    C1[Mount Component]
    C2{Ticket Provided?}
    C3[Consume Ticket]
    C4[Load Cookie Session]
    C5[Hydrate Redux]
    C6[Render Booking]
    C7[Show Unauthorized]
  end

  A1 --> A2
  A2 --> B1
  B1 --> A3
  A3 -- Yes --> A6
  A3 -- No --> A4
  A4 --> B3
  B3 --> B4
  B4 --> A5
  A5 --> A6
  A6 --> C1
  C1 --> C2
  C2 -- Yes --> C3
  C2 -- No --> C4
  C3 --> B5
  B5 --> B6
  B6 -- Yes --> B7
  B7 --> B8
  B8 --> C5
  C4 --> B1
  B1 --> B2
  B2 --> C5
  C5 --> C6
  C6 --> A7
  B6 -- No --> B9
  B9 --> C7
  C7 --> A7
