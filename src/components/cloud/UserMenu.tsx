import { useState, useRef, useEffect } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { LoginModal } from './LoginModal'
import { RegisterModal } from './RegisterModal'

export function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [isOpen, setIsOpen] = useState(false)
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAuthModal('login')}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#94A3B8] text-[0.6875rem] font-semibold text-white">
            G
          </div>
          <div className="min-w-0 flex-1 text-left leading-none">
            <span className="block truncate text-[0.6875rem] font-semibold tracking-[0.01em] text-[#1E293B]">Account</span>
            <span className="block pt-1 text-[0.6875rem] font-medium text-[#94A3B8]">Guest — Sign in</span>
          </div>
        </button>
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

  const initial = user.email.charAt(0).toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6336F1] text-[0.6875rem] font-semibold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1 text-left leading-none">
          <div className="flex items-center gap-1">
            <span className="block truncate text-[0.6875rem] font-semibold tracking-[0.01em] text-[#1E293B]">Account</span>
            <span className="rounded bg-[#6336F1] px-1 py-px text-[0.5625rem] font-bold leading-none text-white">Pro</span>
          </div>
          <span className="block max-w-24 truncate pt-1 text-[0.6875rem] font-medium text-[#94A3B8]">{user.email}</span>
        </div>
        <ChevronDown size={12} className="shrink-0 text-[#94A3B8]" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
          <div className="border-b border-[#EEF0F4] px-3 py-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Signed in</p>
            <p className="mt-1 truncate text-xs font-semibold text-[#0F172A]">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-[#EF4444] hover:bg-red-50"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}