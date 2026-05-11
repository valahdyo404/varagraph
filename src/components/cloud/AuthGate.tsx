import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { LoginModal } from './LoginModal'
import { RegisterModal } from './RegisterModal'

type AuthGateProps = {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [showModal, setShowModal] = useState(false)
  const [modalView, setModalView] = useState<'login' | 'register'>('login')

  if (!isAuthenticated) {
    return (
      <>
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-[#0F172A]">Sign in to sync your diagrams</p>
            <button
              type="button"
              onClick={() => {
                setModalView('login')
                setShowModal(true)
              }}
              className="h-10 rounded-md bg-[#6336F1] px-6 text-sm font-semibold text-white hover:bg-[#5930DE]"
            >
              Sign in
            </button>
          </div>
        </div>
        {showModal && modalView === 'login' && (
          <LoginModal
            onClose={() => setShowModal(false)}
            onSwitchToRegister={() => setModalView('register')}
          />
        )}
        {showModal && modalView === 'register' && (
          <RegisterModal
            onClose={() => setShowModal(false)}
            onSwitchToLogin={() => setModalView('login')}
          />
        )}
      </>
    )
  }

  return <>{children}</>
}