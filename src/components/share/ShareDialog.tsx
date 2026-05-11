import { useEffect, useState } from 'react'
import { useShareStore } from '../../store/shareStore'
import { useEditorStore } from '../../store/editorStore'
import { apiClient } from '../../lib/cloud/apiClient'

type ShareDialogProps = {
  diagramId: string
  open: boolean
  onClose: () => void
}

export const ShareDialog = ({ diagramId, open, onClose }: ShareDialogProps) => {
  const { token, visibility, loading, error, ensureToken, setVisibility, reset } = useShareStore()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || !diagramId) return
    const graph = useEditorStore.getState().graph
    const mermaidSource = useEditorStore.getState().mermaidSource
    apiClient.updateDiagram(diagramId, { graph, mermaid_source: mermaidSource }).then(() => {
      ensureToken(diagramId)
    }).catch(() => {
      ensureToken(diagramId)
    })
    return () => { if (!open) reset() }
  }, [open, diagramId])

  if (!open) return null

  const shareUrl = token ? `${window.location.origin}/share/${token}` : ''

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const handleToggle = (next: 'public' | 'private') => {
    if (next === visibility) return
    setVisibility(diagramId, next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-96 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Share diagram</h2>
          <button className="text-neutral-500 hover:text-neutral-900" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mb-3 flex rounded-lg border border-neutral-200 p-1">
          <button
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${visibility === 'private' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
            onClick={() => handleToggle('private')}
            disabled={loading}
          >
            Private
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${visibility === 'public' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
            onClick={() => handleToggle('public')}
            disabled={loading}
          >
            Public
          </button>
        </div>

        <p className="mb-2 text-xs text-neutral-600">
          {visibility === 'public'
            ? 'Anyone with the link can view read-only.'
            : 'Only you can open this link (must be signed in).'}
        </p>

        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={loading && !shareUrl ? 'Generating link…' : shareUrl}
            className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-800"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            onClick={handleCopy}
            disabled={!shareUrl}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}
