import { EditorShell } from '../components/layout/EditorShell'
import { SharedView } from '../components/share/SharedView'

export default function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const shareMatch = path.match(/^\/share\/([A-Za-z0-9_-]+)\/?$/)
  if (shareMatch) return <SharedView token={shareMatch[1]} />
  return <EditorShell />
}
