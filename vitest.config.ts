import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/graph/orthogonalRouting.ts',
        'src/lib/graph/autoLayout.ts',
        'src/lib/mermaid/parseMermaidSubset.ts',
        'src/lib/graph/exportGraph.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
})