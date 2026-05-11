import { useEffect, useState } from 'react'
import { apiClient } from '../../lib/cloud/apiClient'
import { EditorShell } from '../layout/EditorShell'
import { LoginModal } from '../cloud/LoginModal'
import { RegisterModal } from '../cloud/RegisterModal'
import { useAuthStore } from '../../store/authStore'
import { useDiagramRegistryStore } from '../../store/diagramRegistryStore'
import { exportGraphMermaid } from '../../lib/graph/exportGraph'
import type { GraphModel, LaneIcon } from '../../types/graph'

type SharedState =
  | { status: 'loading' }
  | { status: 'ok'; title: string; editable: boolean; diagramId: string; graph: GraphModel }
  | { status: 'forbidden' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }

const mapSharedGraph = (res: any): GraphModel => {
  const lanes = (res.lanes ?? []).map((lane: any) => ({
    id: String(lane.id),
    title: lane.title ?? 'Untitled lane',
    color: lane.color ?? '#F0E8FF',
    icon: lane.icon as LaneIcon | undefined,
    x: Number(lane.x ?? 0),
    width: Number(lane.width ?? 220),
  }))
  const fallbackLaneId = lanes[0]?.id ?? ''
  const nodes = (res.nodes ?? []).map((node: any) => ({
    id: String(node.id),
    type: 'diagramNode' as const,
    position: { x: Number(node.posX ?? 0), y: Number(node.posY ?? 0) },
    data: {
      label: node.label ?? 'Untitled',
      laneId: node.laneId ?? fallbackLaneId,
      variant: node.variant ?? 'process',
      style: node.styleBg || node.styleBorder || node.styleText ? {
        backgroundColor: node.styleBg ?? undefined,
        borderColor: node.styleBorder ?? undefined,
        textColor: node.styleText ?? undefined,
      } : undefined,
    },
  }))
  const edges = (res.edges ?? []).map((edge: any) => ({
    id: String(edge.id),
    source: String(edge.sourceNodeId),
    target: String(edge.targetNodeId),
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: edge.type ?? 'straight',
    animated: Boolean(edge.animated),
    label: edge.label ?? undefined,
    data: {
      label: edge.label ?? undefined,
      arrowDirection: edge.arrowDirection ?? 'forward',
    },
  }))
  return { lanes, nodes, edges }
}

export const SharedView = ({ token }: { token: string }) => {
  const [state, setState] = useState<SharedState>({ status: 'loading' })
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [saveCopyPending, setSaveCopyPending] = useState(false)
  const [savedCopyReady, setSavedCopyReady] = useState(false)
  const user = useAuthStore((s) => s.user)
  const createDiagramFromGraph = useDiagramRegistryStore((s) => s.createDiagramFromGraph)

  useEffect(() => {
    let cancelled = false
    apiClient
      .getShared(token)
      .then((res) => {
        if (cancelled || !res) return
        const graph = mapSharedGraph(res)
        setState({
          status: 'ok',
          title: res.diagram?.title ?? 'Shared diagram',
          editable: Boolean(res.editable),
          diagramId: String(res.diagram?.id ?? ''),
          graph,
        })
      })
      .catch((err: any) => {
        if (cancelled) return
        const code = err?.error?.code
        if (code === 'FORBIDDEN') setState({ status: 'forbidden' })
        else if (code === 'NOT_FOUND') setState({ status: 'notfound' })
        else setState({ status: 'error', message: err?.error?.message ?? 'Failed to load' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const saveCopy = async () => {
    if (state.status !== 'ok' || state.editable || saveCopyPending) return
    if (!user) {
      setAuthModal('login')
      return
    }
    setSaveCopyPending(true)
    try {
      createDiagramFromGraph(state.graph, exportGraphMermaid(state.graph), state.title)
      window.history.replaceState({}, '', '/')
      setSavedCopyReady(true)
    } finally {
      setSaveCopyPending(false)
    }
  }

  useEffect(() => {
    if (user && authModal === null && saveCopyPending) return
  }, [user, authModal, saveCopyPending])

  if (savedCopyReady) return <EditorShell />
  if (state.status === 'loading') return <Centered>Loading shared diagram…</Centered>
  if (state.status === 'forbidden') {
    return (
      <Centered>
        <p className="mb-2 text-sm font-medium text-neutral-900">This link is private.</p>
        <p className="mb-4 text-xs text-neutral-600">Sign in as owner to view it.</p>
        <a href="/" className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">Go to app</a>
      </Centered>
    )
  }
  if (state.status === 'notfound') return <Centered>This shared link no longer exists.</Centered>
  if (state.status === 'error') return <Centered>{state.message}</Centered>

  return (
    <>
      <EditorShell
        sharedSession={{
          title: state.title,
          graph: state.graph,
          diagramId: state.editable ? state.diagramId : null,
          editable: state.editable,
          ownerView: state.editable,
          onSaveCopy: state.editable ? undefined : saveCopy,
          saveCopyPending,
        }}
      />
      {authModal === 'login' && (
        <LoginModal
          onClose={() => setAuthModal(null)}
          onSwitchToRegister={() => setAuthModal('register')}
        />
      )}
      {authModal === 'register' && (
        <RegisterModal
          onClose={() => setAuthModal(null)}
          onSwitchToLogin={() => setAuthModal('login')}
        />
      )}
    </>
  )
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-50 text-center">
    <div className="max-w-xs text-sm text-neutral-700">{children}</div>
  </div>
)
