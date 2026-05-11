import { create } from 'zustand'
import type { DiagramMeta, DiagramDraft, DiagramIndex } from '../types/diagram'
import type { GraphModel } from '../types/graph'
import { apiClient } from '../lib/cloud/apiClient'

const REGISTRY_KEY = 'varagraph:registry:v2'
const V1_DRAFT_KEY = 'varagraph:draft:v1'

const diagramStorageKey = (id: string) => `varagraph:diagram:${id}:v2`

const hasWindow = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (value: string): boolean => UUID_RE.test(value)

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const rnd = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rnd(3)}-${rnd(12)}`
}

const loadRegistry = (): DiagramIndex | null => {
  if (!hasWindow()) return null
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DiagramIndex
    if (parsed.version !== 2 || !Array.isArray(parsed.diagrams)) return null
    return parsed
  } catch {
    return null
  }
}

const saveRegistry = (index: DiagramIndex): void => {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(index))
  } catch {
    // Persistence is best-effort
  }
}

const loadDiagramData = (id: string): (DiagramDraft & { past?: GraphModel[]; future?: GraphModel[] }) | null => {
  if (!hasWindow()) return null
  try {
    const raw = window.localStorage.getItem(diagramStorageKey(id))
    if (!raw) return null
    return JSON.parse(raw) as DiagramDraft & { past?: GraphModel[]; future?: GraphModel[] }
  } catch {
    return null
  }
}

const saveDiagramData = (id: string, data: DiagramDraft & { past?: GraphModel[]; future?: GraphModel[] }): void => {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(diagramStorageKey(id), JSON.stringify(data))
  } catch {
    // Persistence is best-effort
  }
}

const deleteDiagramData = (id: string): void => {
  if (!hasWindow()) return
  try {
    window.localStorage.removeItem(diagramStorageKey(id))
  } catch {
    // Persistence is best-effort
  }
}

type DiagramRegistryStore = {
  diagrams: DiagramMeta[]
  activeDiagramId: string | null
  setActiveDiagram: (id: string) => void
  createDiagram: (title?: string) => string
  createDiagramFromGraph: (graph: GraphModel, mermaidSource: string, title?: string) => string
  renameDiagram: (id: string, title: string) => void
  deleteDiagram: (id: string) => void
  duplicateDiagram: (id: string) => string
  reorderDiagrams: (fromIndex: number, toIndex: number) => void
  loadRegistry: () => void
  migrateFromV1: () => boolean
  syncFromCloud: () => Promise<void>
}

export const useDiagramRegistryStore = create<DiagramRegistryStore>((set, get) => ({
  diagrams: [],
  activeDiagramId: null,

  setActiveDiagram: (id) => {
    set({ activeDiagramId: id })
    const index: DiagramIndex = { diagrams: get().diagrams, activeDiagramId: id, version: 2 }
    saveRegistry(index)
  },

  createDiagram: (title) => {
    return get().createDiagramFromGraph({ lanes: [], nodes: [], edges: [] }, '', title)
  },

  createDiagramFromGraph: (graph, mermaidSource, title) => {
    const diagrams = get().diagrams
    let id = generateId()
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!diagrams.some((d) => d.id === id)) break
      id = generateId()
    }
    const now = Date.now()
    const meta: DiagramMeta = {
      id,
      title: title || `Untitled ${diagrams.length + 1}`,
      createdAt: now,
      updatedAt: now,
    }
    saveDiagramData(id, { graph, mermaidSource })
    const newDiagrams = [...diagrams, meta]
    set({ diagrams: newDiagrams, activeDiagramId: id })
    saveRegistry({ diagrams: newDiagrams, activeDiagramId: id, version: 2 })

    apiClient.createDiagram(meta.title, { graph }, id).then((result) => {
      if (!result?.id || result.id === id) return
      const cloudId = result.id
      const localData = loadDiagramData(id)
      if (localData) {
        saveDiagramData(cloudId, localData)
        deleteDiagramData(id)
      }
      const updated = get().diagrams.map((d) => (d.id === id ? { ...d, id: cloudId } : d))
      const activeId = get().activeDiagramId === id ? cloudId : get().activeDiagramId
      set({ diagrams: updated, activeDiagramId: activeId })
      saveRegistry({ diagrams: updated, activeDiagramId: activeId, version: 2 })
    }).catch(() => {})

    return id
  },

  renameDiagram: (id, title) => {
    const diagrams = get().diagrams.map((d) => (d.id === id ? { ...d, title, updatedAt: Date.now() } : d))
    set({ diagrams })
    const index: DiagramIndex = { diagrams, activeDiagramId: get().activeDiagramId, version: 2 }
    saveRegistry(index)
  },

  deleteDiagram: (id) => {
    const diagrams = get().diagrams.filter((d) => d.id !== id)
    deleteDiagramData(id)
    let activeDiagramId = get().activeDiagramId
    if (activeDiagramId === id) {
      activeDiagramId = diagrams[0]?.id ?? null
    }
    set({ diagrams, activeDiagramId })
    saveRegistry({ diagrams, activeDiagramId, version: 2 })

    apiClient.deleteDiagram(id).catch(() => {})
  },

  duplicateDiagram: (id) => {
    const diagrams = get().diagrams
    const source = diagrams.find((d) => d.id === id)
    if (!source) return id
    const sourceData = loadDiagramData(id)
    let newId = generateId()
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!diagrams.some((d) => d.id === newId)) break
      newId = generateId()
    }
    const now = Date.now()
    const meta: DiagramMeta = {
      id: newId,
      title: `${source.title} (copy)`,
      createdAt: now,
      updatedAt: now,
    }
    const graphCopy = sourceData ? JSON.parse(JSON.stringify(sourceData.graph)) as GraphModel : { lanes: [], nodes: [], edges: [] }
    const mermaidCopy = sourceData?.mermaidSource ?? ''
    const pastCopy = sourceData?.past ? JSON.parse(JSON.stringify(sourceData.past)) as GraphModel[] : []
    const futureCopy = sourceData?.future ? JSON.parse(JSON.stringify(sourceData.future)) as GraphModel[] : []
    saveDiagramData(newId, { graph: graphCopy, mermaidSource: mermaidCopy, past: pastCopy, future: futureCopy })
    const newDiagrams = [...diagrams, meta]
    set({ diagrams: newDiagrams, activeDiagramId: newId })
    saveRegistry({ diagrams: newDiagrams, activeDiagramId: newId, version: 2 })
    return newId
  },

  reorderDiagrams: (fromIndex, toIndex) => {
    const diagrams = [...get().diagrams]
    const [removed] = diagrams.splice(fromIndex, 1)
    diagrams.splice(toIndex, 0, removed)
    set({ diagrams })
    saveRegistry({ diagrams, activeDiagramId: get().activeDiagramId, version: 2 })
  },

  loadRegistry: () => {
    const migrated = get().migrateFromV1()
    if (migrated) return
    const index = loadRegistry()
    if (!index) {
      const newIndex: DiagramIndex = { diagrams: [], activeDiagramId: null, version: 2 }
      saveRegistry(newIndex)
      set({ diagrams: [], activeDiagramId: null })
      return
    }

    const idRemap = new Map<string, string>()
    const migratedDiagrams = index.diagrams.map((d) => {
      if (isUuid(d.id)) return d
      const newId = generateId()
      idRemap.set(d.id, newId)
      return { ...d, id: newId }
    })
    if (idRemap.size > 0) {
      idRemap.forEach((newId, oldId) => {
        const data = loadDiagramData(oldId)
        if (data) {
          saveDiagramData(newId, data)
          deleteDiagramData(oldId)
        }
      })
      const activeDiagramId = index.activeDiagramId && idRemap.has(index.activeDiagramId)
        ? idRemap.get(index.activeDiagramId)!
        : index.activeDiagramId
      saveRegistry({ diagrams: migratedDiagrams, activeDiagramId, version: 2 })
      set({ diagrams: migratedDiagrams, activeDiagramId })
      migratedDiagrams.forEach((d) => {
        const wasMigrated = [...idRemap.values()].includes(d.id)
        if (!wasMigrated) return
        const data = loadDiagramData(d.id)
        apiClient.createDiagram(d.title, data ? { graph: data.graph } : undefined, d.id).catch(() => {})
      })
      return
    }
    set({ diagrams: index.diagrams, activeDiagramId: index.activeDiagramId })
  },

  migrateFromV1: () => {
    if (!hasWindow()) return false
    const existing = loadRegistry()
    if (existing) return false
    try {
      const v1Raw = window.localStorage.getItem(V1_DRAFT_KEY)
      if (!v1Raw) return false
      const v1Data = JSON.parse(v1Raw) as { graph?: GraphModel; mermaidSource?: string }
      if (!v1Data.graph && !v1Data.mermaidSource) return false
      const id = generateId()
      const now = Date.now()
      const meta: DiagramMeta = {
        id,
        title: 'My Diagram',
        createdAt: now,
        updatedAt: now,
      }
      saveDiagramData(id, { graph: v1Data.graph ?? { lanes: [], nodes: [], edges: [] }, mermaidSource: v1Data.mermaidSource ?? '' })
      const index: DiagramIndex = { diagrams: [meta], activeDiagramId: id, version: 2 }
      saveRegistry(index)
      set({ diagrams: [meta], activeDiagramId: id })
      return true
    } catch {
      return false
    }
  },

  syncFromCloud: async () => {
    try {
      const cloudDiagrams = await apiClient.listDiagrams()
      const cloudIds = new Set(cloudDiagrams.map((d) => d.id))
      const localDiagrams = get().diagrams

      const cloudMetas: DiagramMeta[] = cloudDiagrams.map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: new Date(d.updatedAt).getTime(),
        updatedAt: new Date(d.updatedAt).getTime(),
      }))

      const idRemap = new Map<string, string>()
      const reconciled: DiagramMeta[] = []

      for (const local of localDiagrams) {
        if (cloudIds.has(local.id)) {
          reconciled.push(local)
          continue
        }
        const localData = loadDiagramData(local.id)
        const graph = localData?.graph
        let targetId = local.id
        try {
          const result = await apiClient.createDiagram(local.title, graph ? { graph } : undefined, isUuid(local.id) ? local.id : undefined)
          if (result?.id && result.id !== local.id) {
            targetId = result.id
          }
        } catch (err: any) {
          const code = err?.error?.code
          if (code === 'CONFLICT' || code === 'VALIDATION') {
            const newId = generateId()
            try {
              await apiClient.createDiagram(local.title, graph ? { graph } : undefined, newId)
              targetId = newId
            } catch {
              reconciled.push(local)
              continue
            }
          } else {
            reconciled.push(local)
            continue
          }
        }
        if (targetId !== local.id) {
          if (localData) {
            saveDiagramData(targetId, localData)
            deleteDiagramData(local.id)
          }
          idRemap.set(local.id, targetId)
        }
        reconciled.push({ ...local, id: targetId })
      }

      for (const cloud of cloudMetas) {
        if (!reconciled.some((d) => d.id === cloud.id)) {
          reconciled.push(cloud)
        }
      }

      let activeDiagramId = get().activeDiagramId
      if (activeDiagramId && idRemap.has(activeDiagramId)) {
        activeDiagramId = idRemap.get(activeDiagramId)!
      }
      if (activeDiagramId && !reconciled.some((d) => d.id === activeDiagramId)) {
        activeDiagramId = reconciled[0]?.id ?? null
      }

      set({ diagrams: reconciled, activeDiagramId })
      saveRegistry({ diagrams: reconciled, activeDiagramId, version: 2 })
    } catch {
      // Cloud sync is best-effort
    }
  },
}))