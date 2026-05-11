import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { saveQueue } from '../../lib/cloud/saveQueue'

export function SaveIndicator() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  useEffect(() => {
    const update = () => setStatus(saveQueue.getStatus())
    update()
    return saveQueue.subscribe(update)
  }, [])

  if (status === 'idle') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
        Saved
      </span>
    )
  }

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
        <Loader2 size={13} className="animate-spin text-[#6336F1]" />
        Saving...
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-[#EF4444]">
      <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
      Unsaved
    </span>
  )
}