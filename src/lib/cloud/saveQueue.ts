import { apiClient } from './apiClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class SaveQueue {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private retryCounts: Map<string, number> = new Map()
  private state: { status: 'idle' | 'saving' | 'error'; diagramId: string | null } = {
    status: 'idle',
    diagramId: null,
  }
  private listeners: Set<() => void> = new Set()

  enqueue(diagramId: string, graph: any, mermaidSource: string): void {
    if (!UUID_RE.test(diagramId)) return
    if (this.timers.has(diagramId)) {
      clearTimeout(this.timers.get(diagramId))
    }

    const timer = setTimeout(async () => {
      this.timers.delete(diagramId)
      this.state = { status: 'saving', diagramId }
      this.notify()

      try {
        await apiClient.updateDiagram(diagramId, { graph, mermaid_source: mermaidSource })
        this.retryCounts.delete(diagramId)
        this.state = { status: 'idle', diagramId: null }
      } catch (err: any) {
        const code = err?.error?.code
        if (code === 'NOT_FOUND') {
          try {
            await apiClient.createDiagram('Untitled', { graph }, diagramId)
            await apiClient.updateDiagram(diagramId, { graph, mermaid_source: mermaidSource })
            this.retryCounts.delete(diagramId)
            this.state = { status: 'idle', diagramId: null }
            this.notify()
            return
          } catch {
            // fall through to retry logic
          }
        }
        const count = (this.retryCounts.get(diagramId) ?? 0) + 1
        this.retryCounts.set(diagramId, count)
        if (count < 3) {
          this.timers.set(diagramId, setTimeout(() => this.enqueue(diagramId, graph, mermaidSource), 2000))
        } else {
          this.state = { status: 'error', diagramId }
          this.retryCounts.delete(diagramId)
        }
      }
      this.notify()
    }, 2000)

    this.timers.set(diagramId, timer)
  }

  getStatus(): 'idle' | 'saving' | 'error' {
    return this.state.status
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }
}

export const saveQueue = new SaveQueue()